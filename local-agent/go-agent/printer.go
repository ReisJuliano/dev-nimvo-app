package main

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net"
	"os"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

type paymentReceiptRequest struct {
	StoreName    string                  `json:"store_name"`
	SaleNumber   string                  `json:"sale_number"`
	IssuedAt     string                  `json:"issued_at"`
	Total        float64                 `json:"total"`
	ChangeAmount float64                 `json:"change_amount"`
	Notes        string                  `json:"notes"`
	Customer     *paymentReceiptCustomer `json:"customer"`
	Items        []paymentReceiptItem    `json:"items"`
	Payments     []paymentReceiptPayment `json:"payments"`
}

type paymentReceiptCustomer struct {
	Name string `json:"name"`
}

type paymentReceiptItem struct {
	Name      string  `json:"name"`
	Quantity  float64 `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
	Total     float64 `json:"total"`
}

type paymentReceiptPayment struct {
	Label  string  `json:"label"`
	Amount float64 `json:"amount"`
	Method string  `json:"method"`
}

func printTestReceipt(config PrinterConfig, payload printTestRequest) error {
	if !config.Enabled {
		return errors.New("a impressao local esta desativada neste agente")
	}

	builder := newEscposBuilder()
	builder.init()
	builder.logo(config.LogoPath)
	builder.alignCenter()
	builder.bold(true)
	builder.line(orDefault(strings.TrimSpace(payload.StoreName), "Nimvo"))
	builder.bold(false)
	builder.line("TESTE DE IMPRESSAO LOCAL")
	builder.line("API DO AGENTE GO")
	builder.line(strings.Repeat("=", 48))
	builder.alignLeft()
	builder.line(fmt.Sprintf("Data: %s", formatReceiptDateTime(time.Now().Format(time.RFC3339))))
	builder.line(fmt.Sprintf("Conector: %s", strings.ToUpper(orDefault(config.Connector, "windows"))))
	if target := strings.TrimSpace(printerTarget(config)); target != "" {
		builder.line(fmt.Sprintf("Destino: %s", target))
	}
	builder.line(strings.Repeat("-", 48))
	builder.line(orDefault(strings.TrimSpace(payload.Message), "Se este cupom saiu corretamente, a ponte local do Nimvo esta operacional."))
	builder.line(strings.Repeat("-", 48))
	builder.line("Sem valor fiscal.")
	builder.feed(2)
	builder.cut()

	return writeReceiptToPrinter(config, builder.bytes())
}

func printPaymentReceipt(config PrinterConfig, payload paymentReceiptRequest) error {
	if !config.Enabled {
		return errors.New("a impressao local esta desativada neste agente")
	}

	builder := newEscposBuilder()
	builder.init()
	builder.logo(config.LogoPath)
	builder.alignCenter()
	builder.bold(true)
	builder.line(orDefault(strings.TrimSpace(payload.StoreName), "Nimvo"))
	builder.bold(false)
	builder.line("COMPROVANTE DE PAGAMENTO")
	builder.line(strings.Repeat("=", 48))
	builder.alignLeft()

	if saleNumber := strings.TrimSpace(payload.SaleNumber); saleNumber != "" {
		builder.line(fmt.Sprintf("Venda: %s", saleNumber))
	}
	builder.line(fmt.Sprintf("Emissao: %s", formatReceiptDateTime(payload.IssuedAt)))

	if payload.Customer != nil && strings.TrimSpace(payload.Customer.Name) != "" {
		builder.line(fmt.Sprintf("Cliente: %s", strings.TrimSpace(payload.Customer.Name)))
	}

	if len(payload.Items) > 0 {
		builder.line(strings.Repeat("-", 48))
		builder.bold(true)
		builder.line("Descricao             Qt  VlrUn   Total")
		builder.bold(false)
		for _, item := range payload.Items {
			builder.line(
				formatReceiptColumns(
					item.Name,
					item.Quantity,
					item.UnitPrice,
					item.Total,
				),
			)
		}
	}

	builder.line(strings.Repeat("-", 48))
	builder.line(formatReceiptSummary("Total", payload.Total))
	if payload.ChangeAmount > 0 {
		builder.line(formatReceiptSummary("Troco", payload.ChangeAmount))
	}
	for _, payment := range payload.Payments {
		label := strings.TrimSpace(payment.Label)
		if label == "" {
			label = orDefault(strings.TrimSpace(payment.Method), "Pagamento")
		}
		builder.line(formatReceiptSummary(label, payment.Amount))
	}

	if notes := strings.TrimSpace(payload.Notes); notes != "" {
		builder.line(strings.Repeat("-", 48))
		builder.line(notes)
	}

	builder.feed(2)
	builder.cut()

	return writeReceiptToPrinter(config, builder.bytes())
}

func writeReceiptToPrinter(config PrinterConfig, payload []byte) error {
	writer, err := openPrinterWriter(config)
	if err != nil {
		return err
	}
	defer writer.Close()

	if _, err := writer.Write(payload); err != nil {
		return err
	}

	return nil
}

func openPrinterWriter(config PrinterConfig) (io.WriteCloser, error) {
	connector := strings.ToLower(strings.TrimSpace(config.Connector))
	if connector == "tcp" || connector == "network" {
		address := fmt.Sprintf("%s:%d", strings.TrimSpace(config.Host), config.Port)
		if strings.TrimSpace(config.Host) == "" {
			return nil, errors.New("host da impressora TCP nao informado")
		}

		return net.DialTimeout("tcp", address, 5*time.Second)
	}

	return openWindowsPrinterWriter(strings.TrimSpace(config.Name))
}

type escposBuilder struct {
	buffer bytes.Buffer
}

func newEscposBuilder() *escposBuilder {
	return &escposBuilder{}
}

func (builder *escposBuilder) bytes() []byte {
	return builder.buffer.Bytes()
}

func (builder *escposBuilder) init() {
	builder.command(0x1B, 0x40)
}

func (builder *escposBuilder) alignCenter() {
	builder.command(0x1B, 0x61, 0x01)
}

func (builder *escposBuilder) alignLeft() {
	builder.command(0x1B, 0x61, 0x00)
}

func (builder *escposBuilder) bold(enabled bool) {
	value := byte(0x00)
	if enabled {
		value = 0x01
	}
	builder.command(0x1B, 0x45, value)
}

func (builder *escposBuilder) line(value string) {
	builder.buffer.WriteString(strings.ReplaceAll(value, "\r", ""))
	builder.buffer.WriteByte('\n')
}

func (builder *escposBuilder) feed(lines int) {
	for index := 0; index < maxInt(0, lines); index++ {
		builder.buffer.WriteByte('\n')
	}
}

func (builder *escposBuilder) cut() {
	builder.command(0x1D, 0x56, 0x00)
}

func (builder *escposBuilder) logo(path string) {
	imageData, err := buildEscposLogo(strings.TrimSpace(path), 384)
	if err != nil || len(imageData) == 0 {
		return
	}

	builder.alignCenter()
	builder.buffer.Write(imageData)
	builder.feed(1)
}

func (builder *escposBuilder) command(values ...byte) {
	builder.buffer.Write(values)
}

func buildEscposLogo(path string, maxWidth int) ([]byte, error) {
	if path == "" || !fileExists(path) {
		return nil, nil
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	imageData, _, err := image.Decode(file)
	if err != nil {
		return nil, err
	}

	scaled := resizeImageToWidth(imageData, maxWidth)
	bounds := scaled.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width == 0 || height == 0 {
		return nil, nil
	}

	widthBytes := (width + 7) / 8
	payload := make([]byte, 0, 8+(widthBytes*height))
	payload = append(payload, 0x1D, 0x76, 0x30, 0x00, byte(widthBytes), byte(widthBytes>>8), byte(height), byte(height>>8))

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for xByte := 0; xByte < widthBytes; xByte++ {
			var value byte
			for bit := 0; bit < 8; bit++ {
				x := xByte*8 + bit
				if x >= width {
					continue
				}

				red, green, blue, alpha := scaled.At(bounds.Min.X+x, y).RGBA()
				if alpha <= 0x0100 {
					continue
				}

				luminance := (299*red + 587*green + 114*blue) / 1000
				if luminance < 0xC000 {
					value |= 1 << uint(7-bit)
				}
			}
			payload = append(payload, value)
		}
	}

	return payload, nil
}

func resizeImageToWidth(source image.Image, maxWidth int) image.Image {
	bounds := source.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if width <= 0 || height <= 0 || width <= maxWidth || maxWidth <= 0 {
		return source
	}

	targetHeight := maxInt(1, height*maxWidth/width)
	target := image.NewRGBA(image.Rect(0, 0, maxWidth, targetHeight))

	for y := 0; y < targetHeight; y++ {
		sourceY := bounds.Min.Y + (y * height / targetHeight)
		for x := 0; x < maxWidth; x++ {
			sourceX := bounds.Min.X + (x * width / maxWidth)
			target.Set(x, y, source.At(sourceX, sourceY))
		}
	}

	return target
}

func formatReceiptColumns(name string, quantity, unitPrice, total float64) string {
	return fmt.Sprintf(
		"%s %s %s %s",
		padRight(name, 20),
		padLeft(formatInteger(quantity), 3),
		padLeft(formatCurrency(unitPrice), 7),
		padLeft(formatCurrency(total), 8),
	)
}

func formatReceiptSummary(label string, amount float64) string {
	return padRight(label, 30) + padLeft("R$ "+formatCurrency(amount), 18)
}

func formatCurrency(value float64) string {
	formatted := fmt.Sprintf("%.2f", value)
	return strings.ReplaceAll(formatted, ".", ",")
}

func formatInteger(value float64) string {
	return fmt.Sprintf("%.0f", value)
}

func formatReceiptDateTime(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Now().Format("02/01/2006 15:04:05")
	}

	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return value
	}

	return parsed.Format("02/01/2006 15:04:05")
}

func padRight(value string, width int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) > width {
		runes = runes[:width]
	}

	return string(runes) + strings.Repeat(" ", maxInt(0, width-len(runes)))
}

func padLeft(value string, width int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) > width {
		runes = runes[:width]
	}

	return strings.Repeat(" ", maxInt(0, width-len(runes))) + string(runes)
}

func orDefault(value, fallback string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}

	return fallback
}

type rawPrinterWriter struct {
	handle      syscall.Handle
	pageStarted bool
	docStarted  bool
}

type printerDocInfo1 struct {
	docName    *uint16
	outputFile *uint16
	dataType   *uint16
}

var (
	winspoolDLL          = syscall.NewLazyDLL("winspool.drv")
	openPrinterProc      = winspoolDLL.NewProc("OpenPrinterW")
	startDocPrinterProc  = winspoolDLL.NewProc("StartDocPrinterW")
	startPagePrinterProc = winspoolDLL.NewProc("StartPagePrinter")
	writePrinterProc     = winspoolDLL.NewProc("WritePrinter")
	endPagePrinterProc   = winspoolDLL.NewProc("EndPagePrinter")
	endDocPrinterProc    = winspoolDLL.NewProc("EndDocPrinter")
	closePrinterProc     = winspoolDLL.NewProc("ClosePrinter")
)

func openWindowsPrinterWriter(name string) (*rawPrinterWriter, error) {
	if name == "" {
		return nil, errors.New("nome da impressora do Windows nao informado")
	}

	namePtr, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		return nil, err
	}

	var handle syscall.Handle
	result, _, callErr := openPrinterProc.Call(
		uintptr(unsafe.Pointer(namePtr)),
		uintptr(unsafe.Pointer(&handle)),
		0,
	)
	if result == 0 {
		return nil, fmt.Errorf("nao foi possivel abrir a impressora %s: %s", name, describeSyscallError(callErr))
	}

	docNamePtr, _ := syscall.UTF16PtrFromString("Nimvo Fiscal Agent")
	dataTypePtr, _ := syscall.UTF16PtrFromString("RAW")
	docInfo := printerDocInfo1{
		docName:  docNamePtr,
		dataType: dataTypePtr,
	}

	result, _, callErr = startDocPrinterProc.Call(
		uintptr(handle),
		1,
		uintptr(unsafe.Pointer(&docInfo)),
	)
	if result == 0 {
		closePrinterProc.Call(uintptr(handle))
		return nil, fmt.Errorf("nao foi possivel iniciar o documento de impressao: %s", describeSyscallError(callErr))
	}

	result, _, callErr = startPagePrinterProc.Call(uintptr(handle))
	if result == 0 {
		endDocPrinterProc.Call(uintptr(handle))
		closePrinterProc.Call(uintptr(handle))
		return nil, fmt.Errorf("nao foi possivel iniciar a pagina de impressao: %s", describeSyscallError(callErr))
	}

	return &rawPrinterWriter{
		handle:      handle,
		pageStarted: true,
		docStarted:  true,
	}, nil
}

func (writer *rawPrinterWriter) Write(payload []byte) (int, error) {
	if len(payload) == 0 {
		return 0, nil
	}

	var written uint32
	result, _, callErr := writePrinterProc.Call(
		uintptr(writer.handle),
		uintptr(unsafe.Pointer(&payload[0])),
		uintptr(uint32(len(payload))),
		uintptr(unsafe.Pointer(&written)),
	)
	if result == 0 {
		return int(written), fmt.Errorf("nao foi possivel enviar os dados para a impressora: %s", describeSyscallError(callErr))
	}

	return int(written), nil
}

func (writer *rawPrinterWriter) Close() error {
	var firstErr error

	if writer.pageStarted {
		if result, _, callErr := endPagePrinterProc.Call(uintptr(writer.handle)); result == 0 && firstErr == nil {
			firstErr = fmt.Errorf("nao foi possivel finalizar a pagina de impressao: %s", describeSyscallError(callErr))
		}
		writer.pageStarted = false
	}

	if writer.docStarted {
		if result, _, callErr := endDocPrinterProc.Call(uintptr(writer.handle)); result == 0 && firstErr == nil {
			firstErr = fmt.Errorf("nao foi possivel finalizar o documento de impressao: %s", describeSyscallError(callErr))
		}
		writer.docStarted = false
	}

	if writer.handle != 0 {
		if result, _, callErr := closePrinterProc.Call(uintptr(writer.handle)); result == 0 && firstErr == nil {
			firstErr = fmt.Errorf("nao foi possivel fechar a impressora: %s", describeSyscallError(callErr))
		}
		writer.handle = 0
	}

	return firstErr
}

func describeSyscallError(err error) string {
	if err == nil || errors.Is(err, syscall.Errno(0)) {
		return "erro desconhecido"
	}

	return err.Error()
}
