package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type fiscalReceiptRequest struct {
	StoreName          string           `json:"store_name"`
	Profile            map[string]any   `json:"profile"`
	Sale               map[string]any   `json:"sale"`
	Items              []map[string]any `json:"items"`
	Payments           []map[string]any `json:"payments"`
	Consumer           map[string]any   `json:"consumer"`
	AccessKey          string           `json:"access_key"`
	QRCode             string           `json:"qr_code"`
	Protocol           string           `json:"protocol"`
	AuthorizedAt       string           `json:"authorized_at"`
	ApproxTaxes        float64          `json:"approx_taxes"`
	ApproxTaxesPercent float64          `json:"approx_taxes_percent"`
	ApproxTaxesSource  string           `json:"approx_taxes_source"`
	AdditionalInfo     string           `json:"additional_info"`
}

// companyInfo carries the store's fiscal identity (CNPJ/IE/address) so
// non-fiscal coupons (payment/operation) can show a proper header too,
// reusing whatever the tenant already filled in its fiscal profile even
// when NFC-e emission itself is turned off.
type companyInfo struct {
	Name    string `json:"name"`
	CNPJ    string `json:"cnpj"`
	IE      string `json:"ie"`
	Address string `json:"address"`
}

func companyHeaderLines(company *companyInfo, columns int) []string {
	if company == nil {
		return nil
	}

	lines := []string{}
	idLine := ""
	if strings.TrimSpace(company.CNPJ) != "" {
		idLine = "CNPJ: " + strings.TrimSpace(company.CNPJ)
	}
	if strings.TrimSpace(company.IE) != "" {
		idLine = firstNonEmpty(idLine, "")
		if idLine != "" {
			idLine += "  "
		}
		idLine += "IE: " + strings.TrimSpace(company.IE)
	}
	if idLine != "" {
		lines = append(lines, centerText(idLine, columns))
	}

	if address := strings.TrimSpace(company.Address); address != "" {
		for _, wrapped := range wrapReceiptText(address, columns) {
			lines = append(lines, centerText(wrapped, columns))
		}
	}

	return lines
}

type operationReceiptRequest struct {
	Type          string         `json:"type"`
	StoreName     string         `json:"store_name"`
	Company       *companyInfo   `json:"company"`
	IssuedAt      string         `json:"issued_at"`
	Amount        float64        `json:"amount"`
	Reason        string         `json:"reason"`
	Operator      string         `json:"operator"`
	CustomerName  string         `json:"customer_name"`
	DueAt         string         `json:"due_at"`
	PaymentMethod string         `json:"payment_method"`
	TxID          string         `json:"txid"`
	EndToEndID    string         `json:"end_to_end_id"`
	Brand         string         `json:"brand"`
	Installments  int            `json:"installments"`
	BalanceBefore *float64       `json:"balance_before"`
	BalanceAfter  *float64       `json:"balance_after"`
	Extra         map[string]any `json:"extra"`
}

func executeLocalPrint(config AgentConfig, path string, payload any, local func() (string, error)) (string, error) {
	var outputPath string
	var err error

	defer func() {
		status := "printed"
		message := ""
		if err != nil {
			status = "failed"
			message = err.Error()
		}
		updateLocalPrintState(status, message)
	}()

	if strings.EqualFold(strings.TrimSpace(config.Printer.Mode), "relay") {
		err = relayPrint(config, path, payload)
		return "", err
	}

	outputPath, err = local()
	return outputPath, err
}

func relayPrint(config AgentConfig, path string, payload any) error {
	target := strings.TrimSpace(config.Printer.RelayTarget)
	if target == "" {
		return errors.New("modo relay ativo, mas printer.relay_target nao foi configurado")
	}

	if !strings.HasPrefix(target, "http://") && !strings.HasPrefix(target, "https://") {
		target = "http://" + target
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return errors.New("nao foi possivel preparar o payload para relay")
	}

	request, err := http.NewRequest(http.MethodPost, strings.TrimRight(target, "/")+path, bytes.NewReader(body))
	if err != nil {
		return err
	}

	agentKey := strings.TrimSpace(config.Printer.RelayAgentKey)
	if agentKey == "" {
		agentKey = strings.TrimSpace(config.Agent.Key)
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("X-Nimvo-Agent-Key", agentKey)

	client := &http.Client{Timeout: 3 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("agente relay %s nao respondeu: %w", target, err)
	}
	defer response.Body.Close()

	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	if response.StatusCode >= 400 {
		message := strings.TrimSpace(fmt.Sprint(decoded["error"]))
		if message == "" || message == "<nil>" {
			message = strings.TrimSpace(fmt.Sprint(decoded["message"]))
		}
		if message == "" || message == "<nil>" {
			message = fmt.Sprintf("agente relay retornou HTTP %d", response.StatusCode)
		}

		return errors.New(message)
	}

	return nil
}

func updateLocalPrintState(status, message string) {
	localAgentPrintState.Lock()
	defer localAgentPrintState.Unlock()

	localAgentPrintState.LastStatus = status
	localAgentPrintState.LastError = message
	localAgentPrintState.LastAt = time.Now()
}

func localPrintSnapshot() map[string]any {
	localAgentPrintState.Lock()
	defer localAgentPrintState.Unlock()

	return map[string]any{
		"status": localAgentPrintState.LastStatus,
		"error":  localAgentPrintState.LastError,
		"at":     optionalTime(localAgentPrintState.LastAt),
	}
}

func optionalTime(value time.Time) any {
	if value.IsZero() {
		return nil
	}

	return value.Format(time.RFC3339)
}

func printFiscalReceipt(config PrinterConfig, payload fiscalReceiptRequest) (string, error) {
	if !config.Enabled {
		return "", errors.New("a impressao local esta desativada neste agente")
	}

	if usePDF, notice := resolvePrintDestination(config); usePDF {
		lines := withFallbackNotice(buildFiscalReceiptLines(config, payload), notice)
		return writeReceiptPreviewPDF(config, "fiscal", lines)
	}

	columns := receiptColumns(config)
	separator := strings.Repeat("-", columns)
	storeName := firstNonEmpty(payload.StoreName, stringFromMap(payload.Profile, "trade_name"), stringFromMap(payload.Profile, "company_name"), "Nimvo")
	accessKey := firstNonEmpty(payload.AccessKey, stringFromMap(payload.Sale, "access_key"))
	protocol := firstNonEmpty(payload.Protocol, stringFromMap(payload.Sale, "protocol"), stringFromMap(payload.Sale, "sefaz_protocol"))
	authorizedAt := firstNonEmpty(payload.AuthorizedAt, stringFromMap(payload.Sale, "authorized_at"))
	isFiscal := accessKey != "" && protocol != ""

	builder := newEscposBuilder()
	builder.init()
	builder.logo(config.LogoPath)
	builder.alignCenter()
	builder.bold(true)
	builder.line(storeName)
	builder.bold(false)
	builder.line("DANFE NFC-e")
	builder.line("Documento auxiliar da Nota Fiscal de Consumidor Eletronica")
	if !isFiscal {
		builder.bold(true)
		builder.line("SEM VALOR FISCAL")
		builder.bold(false)
	}
	builder.line(separator)
	builder.alignLeft()

	builder.bold(true)
	builder.line("ITENS")
	builder.bold(false)
	for _, item := range payload.Items {
		name := firstNonEmpty(stringFromMap(item, "name"), stringFromMap(item, "description"), "Item")
		qty := numberFromMap(item, "quantity")
		unitPrice := numberFromMap(item, "unit_price")
		total := firstPositive(numberFromMap(item, "total"), qty*unitPrice)
		weighable := stringFromMap(item, "unit") == "KG"
		for _, wrapped := range wrapReceiptText(name, columns) {
			builder.line(wrapped)
		}
		builder.line(formatFiscalItemLine(qty, unitPrice, total, columns, weighable))
	}

	builder.line(separator)
	builder.bold(true)
	builder.line(formatReceiptAmountLine("TOTAL", numberFromMap(payload.Sale, "total"), columns))
	builder.bold(false)
	for _, payment := range payload.Payments {
		label := firstNonEmpty(stringFromMap(payment, "label"), stringFromMap(payment, "method"), "Pagamento")
		builder.line(formatReceiptAmountLine(label, numberFromMap(payment, "amount"), columns))
	}

	taxes := firstPositive(payload.ApproxTaxes, numberFromMap(payload.Sale, "approx_taxes"))
	taxesPercent := firstPositive(payload.ApproxTaxesPercent, numberFromMap(payload.Sale, "approx_taxes_percent"))
	if taxes > 0 {
		source := firstNonEmpty(payload.ApproxTaxesSource, stringFromMap(payload.Sale, "approx_taxes_source"), "IBPT")
		builder.line(separator)
		builder.line(fmt.Sprintf("Trib aprox: R$ %s (%.2f%%) Fonte: %s", formatCurrency(taxes), taxesPercent, source))
	}

	builder.line(separator)
	if accessKey != "" {
		builder.line("Chave de acesso:")
		for _, wrapped := range wrapReceiptText(formatAccessKey(accessKey), columns) {
			builder.line(wrapped)
		}
	}

	consumerName := strings.TrimSpace(stringFromMap(payload.Consumer, "name"))
	consumerDocument := strings.TrimSpace(stringFromMap(payload.Consumer, "document"))
	if consumerName == "" && consumerDocument == "" {
		builder.line("Consumidor: CONSUMIDOR NAO IDENTIFICADO")
	} else {
		for _, wrapped := range wrapReceiptText("Consumidor: "+strings.TrimSpace(consumerName+" "+consumerDocument), columns) {
			builder.line(wrapped)
		}
	}

	if protocol != "" {
		builder.line("Protocolo: " + protocol)
	}
	if authorizedAt != "" {
		builder.line("Autorizacao: " + formatReceiptDateTime(authorizedAt))
	}

	if qr := strings.TrimSpace(resolveFiscalQRCode(payload)); qr != "" {
		builder.feed(1)
		builder.alignCenter()
		builder.qrCode(qr)
		builder.alignLeft()
	}

	if info := strings.TrimSpace(payload.AdditionalInfo); info != "" {
		builder.line(separator)
		for _, wrapped := range wrapReceiptText(info, columns) {
			builder.line(wrapped)
		}
	}

	if !isFiscal {
		builder.line(separator)
		builder.alignCenter()
		builder.bold(true)
		builder.line("SEM VALOR FISCAL")
		builder.bold(false)
		builder.alignLeft()
	}

	builder.feed(2)
	builder.cut()

	return "", writeReceiptToPrinter(config, builder.bytes())
}

func buildFiscalReceiptLines(config PrinterConfig, payload fiscalReceiptRequest) []string {
	columns := receiptColumns(config)
	separator := strings.Repeat("-", columns)
	storeName := firstNonEmpty(payload.StoreName, stringFromMap(payload.Profile, "trade_name"), stringFromMap(payload.Profile, "company_name"), "Nimvo")
	accessKey := firstNonEmpty(payload.AccessKey, stringFromMap(payload.Sale, "access_key"))
	protocol := firstNonEmpty(payload.Protocol, stringFromMap(payload.Sale, "protocol"), stringFromMap(payload.Sale, "sefaz_protocol"))
	authorizedAt := firstNonEmpty(payload.AuthorizedAt, stringFromMap(payload.Sale, "authorized_at"))

	lines := []string{
		centerText(storeName, columns),
		centerText("DANFE NFC-e", columns),
		centerText("Documento auxiliar da Nota Fiscal de Consumidor Eletronica", columns),
		separator,
		"ITENS",
	}

	for _, item := range payload.Items {
		name := firstNonEmpty(stringFromMap(item, "name"), stringFromMap(item, "description"), "Item")
		qty := numberFromMap(item, "quantity")
		unitPrice := numberFromMap(item, "unit_price")
		total := firstPositive(numberFromMap(item, "total"), qty*unitPrice)
		weighable := stringFromMap(item, "unit") == "KG"
		lines = append(lines, wrapReceiptText(name, columns)...)
		lines = append(lines, formatFiscalItemLine(qty, unitPrice, total, columns, weighable))
	}

	lines = append(lines, separator)
	lines = append(lines, formatReceiptAmountLine("TOTAL", numberFromMap(payload.Sale, "total"), columns))
	for _, payment := range payload.Payments {
		label := firstNonEmpty(stringFromMap(payment, "label"), stringFromMap(payment, "method"), "Pagamento")
		lines = append(lines, formatReceiptAmountLine(label, numberFromMap(payment, "amount"), columns))
	}

	taxes := firstPositive(payload.ApproxTaxes, numberFromMap(payload.Sale, "approx_taxes"))
	taxesPercent := firstPositive(payload.ApproxTaxesPercent, numberFromMap(payload.Sale, "approx_taxes_percent"))
	if taxes > 0 {
		source := firstNonEmpty(payload.ApproxTaxesSource, stringFromMap(payload.Sale, "approx_taxes_source"), "IBPT")
		lines = append(lines, separator)
		lines = append(lines, fmt.Sprintf("Trib aprox: R$ %s (%.2f%%) Fonte: %s", formatCurrency(taxes), taxesPercent, source))
	}

	lines = append(lines, separator)
	if accessKey != "" {
		lines = append(lines, "Chave de acesso:")
		lines = append(lines, wrapReceiptText(formatAccessKey(accessKey), columns)...)
	}

	consumerName := strings.TrimSpace(stringFromMap(payload.Consumer, "name"))
	consumerDocument := strings.TrimSpace(stringFromMap(payload.Consumer, "document"))
	if consumerName == "" && consumerDocument == "" {
		lines = append(lines, "Consumidor: CONSUMIDOR NAO IDENTIFICADO")
	} else {
		lines = append(lines, wrapReceiptText("Consumidor: "+strings.TrimSpace(consumerName+" "+consumerDocument), columns)...)
	}

	if protocol != "" {
		lines = append(lines, "Protocolo: "+protocol)
	}
	if authorizedAt != "" {
		lines = append(lines, "Autorizacao: "+formatReceiptDateTime(authorizedAt))
	}
	if info := strings.TrimSpace(payload.AdditionalInfo); info != "" {
		lines = append(lines, separator)
		lines = append(lines, wrapReceiptText(info, columns)...)
	}

	return lines
}

func printOperationReceipt(config PrinterConfig, payload operationReceiptRequest) (string, error) {
	if !config.Enabled {
		return "", errors.New("a impressao local esta desativada neste agente")
	}

	if usePDF, notice := resolvePrintDestination(config); usePDF {
		lines := withFallbackNotice(buildOperationReceiptLines(config, payload), notice)
		return writeReceiptPreviewPDF(config, "operacao", lines)
	}

	columns := receiptColumns(config)
	separator := strings.Repeat("-", columns)
	title := operationTitle(payload)

	builder := newEscposBuilder()
	builder.init()
	builder.logo(config.LogoPath)
	builder.alignCenter()
	builder.bold(true)
	builder.line(firstNonEmpty(payload.StoreName, "Nimvo"))
	builder.bold(false)
	for _, line := range companyHeaderLines(payload.Company, columns) {
		builder.line(line)
	}
	builder.bold(true)
	builder.line(title)
	builder.bold(false)
	builder.line(separator)
	builder.alignLeft()

	builder.line("Data: " + formatReceiptDateTime(payload.IssuedAt))

	if payload.Amount > 0 {
		builder.bold(true)
		builder.line(formatReceiptAmountLine("Valor", payload.Amount, columns))
		builder.bold(false)
	}
	if payload.Reason != "" {
		for _, wrapped := range wrapReceiptText("Motivo: "+payload.Reason, columns) {
			builder.line(wrapped)
		}
	}
	if payload.Operator != "" {
		builder.line("Operador: " + payload.Operator)
	}
	if payload.CustomerName != "" {
		builder.line("Cliente: " + payload.CustomerName)
	}
	if payload.DueAt != "" {
		builder.line("Vencimento: " + formatReceiptDateTime(payload.DueAt))
	}
	if payload.TxID != "" {
		builder.line("TXID: " + payload.TxID)
	}
	if payload.EndToEndID != "" {
		builder.line("E2E: " + payload.EndToEndID)
	}
	if payload.Brand != "" {
		builder.line("Bandeira: " + payload.Brand)
	}
	if payload.Installments > 0 {
		builder.line(fmt.Sprintf("Parcelas: %dx", payload.Installments))
	}
	if payload.BalanceBefore != nil {
		builder.line(formatReceiptAmountLine("Saldo antes", *payload.BalanceBefore, columns))
	}
	if payload.BalanceAfter != nil {
		builder.line(formatReceiptAmountLine("Saldo depois", *payload.BalanceAfter, columns))
	}

	builder.line(separator)
	builder.alignCenter()
	builder.bold(true)
	builder.line("SEM VALOR FISCAL")
	builder.bold(false)
	builder.alignLeft()

	builder.feed(2)
	builder.cut()

	return "", writeReceiptToPrinter(config, builder.bytes())
}

func buildOperationReceiptLines(config PrinterConfig, payload operationReceiptRequest) []string {
	columns := receiptColumns(config)
	separator := strings.Repeat("-", columns)
	title := operationTitle(payload)
	lines := []string{centerText(firstNonEmpty(payload.StoreName, "Nimvo"), columns)}
	lines = append(lines, companyHeaderLines(payload.Company, columns)...)
	lines = append(lines,
		centerText(title, columns),
		separator,
		"Data: "+formatReceiptDateTime(payload.IssuedAt),
	)

	if payload.Amount > 0 {
		lines = append(lines, formatReceiptAmountLine("Valor", payload.Amount, columns))
	}
	if payload.Reason != "" {
		lines = append(lines, wrapReceiptText("Motivo: "+payload.Reason, columns)...)
	}
	if payload.Operator != "" {
		lines = append(lines, "Operador: "+payload.Operator)
	}
	if payload.CustomerName != "" {
		lines = append(lines, "Cliente: "+payload.CustomerName)
	}
	if payload.DueAt != "" {
		lines = append(lines, "Vencimento: "+formatReceiptDateTime(payload.DueAt))
	}
	if payload.TxID != "" {
		lines = append(lines, "TXID: "+payload.TxID)
	}
	if payload.EndToEndID != "" {
		lines = append(lines, "E2E: "+payload.EndToEndID)
	}
	if payload.Brand != "" {
		lines = append(lines, "Bandeira: "+payload.Brand)
	}
	if payload.Installments > 0 {
		lines = append(lines, fmt.Sprintf("Parcelas: %dx", payload.Installments))
	}
	if payload.BalanceBefore != nil {
		lines = append(lines, formatReceiptAmountLine("Saldo antes", *payload.BalanceBefore, columns))
	}
	if payload.BalanceAfter != nil {
		lines = append(lines, formatReceiptAmountLine("Saldo depois", *payload.BalanceAfter, columns))
	}

	lines = append(lines, separator, centerText("SEM VALOR FISCAL", columns))
	return lines
}

func operationTitle(payload operationReceiptRequest) string {
	switch strings.ToLower(strings.TrimSpace(payload.Type)) {
	case "cash_withdrawal", "withdrawal", "sangria":
		return "SANGRIA DE CAIXA"
	case "cash_supply", "supply", "suprimento":
		return "SUPRIMENTO DE CAIXA"
	case "pix":
		return "PAGAMENTO VIA PIX"
	case "debit_card":
		return "PAGAMENTO NO CARTAO - DEBITO"
	case "credit_card":
		return "PAGAMENTO NO CARTAO - CREDITO"
	case "credit", "fiado":
		return "VENDA A PRAZO (FIADO)"
	default:
		return "COMPROVANTE OPERACIONAL"
	}
}

func resolveFiscalQRCode(payload fiscalReceiptRequest) string {
	if payload.QRCode != "" {
		return payload.QRCode
	}

	return firstNonEmpty(stringFromMap(payload.Sale, "qr_code"), stringFromMap(payload.Sale, "qr_code_url"))
}

func receiptColumns(config PrinterConfig) int {
	width := strings.ToLower(strings.TrimSpace(config.PaperWidth))
	if strings.Contains(width, "58") || width == "32" {
		return 32
	}

	return 48
}

func formatFiscalItemLine(qty, unitPrice, total float64, columns int, weighable bool) string {
	var left string
	if weighable {
		left = fmt.Sprintf("%sKG x R$ %s", formatWeight(qty), formatCurrency(unitPrice))
	} else {
		left = fmt.Sprintf("%sx R$ %s", formatCurrency(qty), formatCurrency(unitPrice))
	}
	right := "R$ " + formatCurrency(total)
	return padRight(left, maxInt(1, columns-len([]rune(right)))) + right
}

func formatReceiptAmountLine(label string, amount float64, columns int) string {
	right := "R$ " + formatCurrency(amount)
	return padRight(label, maxInt(1, columns-len([]rune(right)))) + right
}

func formatAccessKey(value string) string {
	digits := onlyDigits(value)
	if digits == "" {
		return value
	}

	parts := []string{}
	for len(digits) > 0 {
		chunk := digits
		if len(chunk) > 4 {
			chunk = digits[:4]
		}
		parts = append(parts, chunk)
		digits = digits[len(chunk):]
	}

	return strings.Join(parts, " ")
}

func onlyDigits(value string) string {
	builder := strings.Builder{}
	for _, char := range value {
		if char >= '0' && char <= '9' {
			builder.WriteRune(char)
		}
	}

	return builder.String()
}

func centerText(value string, width int) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) >= width {
		return padRight(value, width)
	}

	left := (width - len([]rune(value))) / 2
	return strings.Repeat(" ", left) + value
}

func wrapReceiptText(value string, width int) []string {
	words := strings.Fields(value)
	if len(words) == 0 {
		return []string{""}
	}

	lines := []string{}
	current := ""
	for _, word := range words {
		next := strings.TrimSpace(current + " " + word)
		if len([]rune(next)) > width && current != "" {
			lines = append(lines, current)
			current = word
			continue
		}
		current = next
	}
	if current != "" {
		lines = append(lines, current)
	}

	return lines
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}

	return ""
}

func firstPositive(values ...float64) float64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}

	return 0
}

func stringFromMap(payload map[string]any, key string) string {
	if payload == nil {
		return ""
	}

	value, ok := payload[key]
	if !ok || value == nil {
		return ""
	}

	return strings.TrimSpace(fmt.Sprint(value))
}

func numberFromMap(payload map[string]any, key string) float64 {
	if payload == nil {
		return 0
	}

	switch value := payload[key].(type) {
	case float64:
		return value
	case int:
		return float64(value)
	case json.Number:
		parsed, _ := value.Float64()
		return parsed
	case string:
		var parsed float64
		_, _ = fmt.Sscanf(strings.ReplaceAll(value, ",", "."), "%f", &parsed)
		return parsed
	default:
		return 0
	}
}

func (builder *escposBuilder) qrCode(value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}

	data := []byte(value)
	builder.command(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
	builder.command(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06)
	builder.command(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31)
	length := len(data) + 3
	builder.command(0x1D, 0x28, 0x6B, byte(length), byte(length>>8), 0x31, 0x50, 0x30)
	builder.buffer.Write(data)
	builder.command(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)
}
