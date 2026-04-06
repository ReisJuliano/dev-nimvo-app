#ifndef AppVersion
  #define AppVersion "dev"
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif
#ifndef InstallerBaseName
  #define InstallerBaseName "nimvo-fiscal-agent-setup"
#endif
#ifndef AgentBinary
  #define AgentBinary "nimvo-fiscal-agent.exe"
#endif
#ifndef AgentIcon
  #define AgentIcon "nimvo.ico"
#endif
#ifndef AgentLogo
  #define AgentLogo "nimvo-logo.png"
#endif
#ifndef InstallMarker
  #define InstallMarker "installer-marker.txt"
#endif
#ifndef SetupIconFile
  #define SetupIconFile AgentIcon
#endif

[Setup]
AppId={{9A902710-C1D1-4BD9-909E-5B6447D472D0}
AppName=Nimvo Fiscal Agent
AppVersion={#AppVersion}
AppPublisher=Nimvo
AppPublisherURL=https://nimvo.com.br
DefaultDirName={localappdata}\NimvoFiscalAgent
DefaultGroupName=Nimvo Fiscal Agent
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UsePreviousAppDir=yes
ShowLanguageDialog=no
DirExistsWarning=no
SetupIconFile={#SetupIconFile}
UninstallDisplayIcon={app}\assets\nimvo.ico
OutputDir={#OutputDir}
OutputBaseFilename={#InstallerBaseName}
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "{#AgentBinary}"; Flags: dontcopy
Source: "{#AgentIcon}"; Flags: dontcopy
Source: "{#AgentLogo}"; Flags: dontcopy
Source: "{#InstallMarker}"; DestDir: "{app}"; DestName: "installer-marker.txt"; Flags: ignoreversion

[UninstallRun]
Filename: "{app}\bin\nimvo-fiscal-agent.exe"; Parameters: "uninstall --install-dir ""{app}"""; RunOnceId: "nimvo-agent-uninstall"; Flags: runhidden waituntilterminated skipifdoesntexist

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
var
  ConnectionPage: TWizardPage;
  CertificatePage: TWizardPage;
  PrintingPage: TWizardPage;

  BackendUrlEdit: TNewEdit;
  ActivationCodeEdit: TNewEdit;
  PollIntervalEdit: TNewEdit;
  CertificatePathEdit: TNewEdit;
  CertificatePasswordEdit: TPasswordEdit;

  EnablePrintingCheck: TNewCheckBox;
  ConnectorCombo: TNewComboBox;
  PrinterNameCombo: TNewComboBox;
  TcpHostEdit: TNewEdit;
  TcpPortEdit: TNewEdit;

  PrinterNameLabel: TNewStaticText;
  PrinterHintLabel: TNewStaticText;
  TcpHostLabel: TNewStaticText;
  TcpPortLabel: TNewStaticText;
  PdfHintLabel: TNewStaticText;

  RefreshPrintersButton: TNewButton;

  BootstrapExePath: string;
  SeedConfigPath: string;
  InstallLogPath: string;

function EscapeJson(const Value: string): string;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\\"', True);
  StringChangeEx(Result, #13#10, '\n', True);
  StringChangeEx(Result, #13, '\n', True);
  StringChangeEx(Result, #10, '\n', True);
end;

function ReadTextFileSafe(const FileName: string): string;
var
  Lines: TArrayOfString;
  I: Integer;
begin
  Result := '';
  if not LoadStringsFromFile(FileName, Lines) then begin
    Exit;
  end;

  for I := 0 to GetArrayLength(Lines) - 1 do begin
    if Result <> '' then begin
      Result := Result + #13#10;
    end;
    Result := Result + Lines[I];
  end;
end;

function GetConnectorValue: string;
begin
  Result := Lowercase(Trim(ConnectorCombo.Text));
end;

function GetPreviewOutputDir: string;
begin
  Result := ExpandConstant('{userdocs}\NimvoFiscalAgent\prints');
end;

procedure UpdatePrintingControls;
var
  PrintingEnabled: Boolean;
  ConnectorValue: string;
begin
  PrintingEnabled := EnablePrintingCheck.Checked;
  ConnectorValue := GetConnectorValue;

  ConnectorCombo.Enabled := PrintingEnabled;
  RefreshPrintersButton.Enabled := PrintingEnabled and (ConnectorValue = 'windows');

  PrinterNameLabel.Visible := PrintingEnabled and (ConnectorValue = 'windows');
  PrinterNameCombo.Visible := PrintingEnabled and (ConnectorValue = 'windows');
  PrinterHintLabel.Visible := PrintingEnabled and (ConnectorValue = 'windows');

  TcpHostLabel.Visible := PrintingEnabled and (ConnectorValue = 'tcp');
  TcpHostEdit.Visible := PrintingEnabled and (ConnectorValue = 'tcp');
  TcpPortLabel.Visible := PrintingEnabled and (ConnectorValue = 'tcp');
  TcpPortEdit.Visible := PrintingEnabled and (ConnectorValue = 'tcp');

  PdfHintLabel.Visible := PrintingEnabled and (ConnectorValue = 'pdf');
end;

function RunHiddenCommand(const CommandLine: string; const OutputFile: string; var ResultCode: Integer): Boolean;
begin
  if FileExists(OutputFile) then begin
    DeleteFile(OutputFile);
  end;

  Result := Exec(
    ExpandConstant('{cmd}'),
    '/C ' + AddQuotes(CommandLine + ' > ' + AddQuotes(OutputFile) + ' 2>&1'),
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  );
end;

procedure PopulatePrinterList;
var
  ResultCode: Integer;
  OutputFile: string;
  OutputText: string;
  Lines: TArrayOfString;
  I: Integer;
  CurrentPrinter: string;
begin
  CurrentPrinter := Trim(PrinterNameCombo.Text);
  OutputFile := ExpandConstant('{tmp}\nimvo-agent-printers.txt');
  PrinterNameCombo.Items.Clear;

  if RunHiddenCommand(AddQuotes(BootstrapExePath) + ' list-printers', OutputFile, ResultCode) and (ResultCode = 0) then begin
    if LoadStringsFromFile(OutputFile, Lines) then begin
      for I := 0 to GetArrayLength(Lines) - 1 do begin
        if Trim(Lines[I]) <> '' then begin
          PrinterNameCombo.Items.Add(Trim(Lines[I]));
        end;
      end;
    end;
  end;

  if CurrentPrinter <> '' then begin
    PrinterNameCombo.Text := CurrentPrinter;
  end else if PrinterNameCombo.Items.Count > 0 then begin
    PrinterNameCombo.ItemIndex := 0;
  end;

  if PrinterNameCombo.Items.Count > 0 then begin
    PrinterHintLabel.Caption := 'Use uma impressora termica ou ESC/POS. Impressoras virtuais sao filtradas automaticamente.';
  end else begin
    OutputText := Trim(ReadTextFileSafe(OutputFile));
    if OutputText <> '' then begin
      PrinterHintLabel.Caption := 'Nao foi possivel listar as impressoras automaticamente. Voce pode digitar o nome manualmente ou usar o modo PDF.';
    end else begin
      PrinterHintLabel.Caption := 'Nenhuma impressora compativel foi encontrada agora. Voce pode digitar o nome manualmente ou usar o modo PDF.';
    end;
  end;
end;

procedure ConnectorChanged(Sender: TObject);
begin
  UpdatePrintingControls;
end;

procedure EnablePrintingChanged(Sender: TObject);
begin
  UpdatePrintingControls;
end;

procedure RefreshPrintersClicked(Sender: TObject);
begin
  PopulatePrinterList;
end;

function ValidateConnectionPage: Boolean;
var
  PollSeconds: Integer;
begin
  Result := False;

  if Trim(BackendUrlEdit.Text) = '' then begin
    MsgBox('Informe a URL do backend do Nimvo para continuar.', mbError, MB_OK);
    WizardForm.ActiveControl := BackendUrlEdit;
    Exit;
  end;

  if Trim(ActivationCodeEdit.Text) = '' then begin
    MsgBox('Informe o codigo de ativacao do tenant para continuar.', mbError, MB_OK);
    WizardForm.ActiveControl := ActivationCodeEdit;
    Exit;
  end;

  PollSeconds := StrToIntDef(Trim(PollIntervalEdit.Text), 0);
  if PollSeconds <= 0 then begin
    MsgBox('Informe um polling em segundos maior que zero.', mbError, MB_OK);
    WizardForm.ActiveControl := PollIntervalEdit;
    Exit;
  end;

  Result := True;
end;

function ValidateCertificatePage: Boolean;
begin
  Result := False;

  if (Trim(CertificatePathEdit.Text) = '') and (Trim(CertificatePasswordEdit.Text) <> '') then begin
    MsgBox('Informe o arquivo do certificado digital antes de preencher a senha.', mbError, MB_OK);
    WizardForm.ActiveControl := CertificatePathEdit;
    Exit;
  end;

  if (Trim(CertificatePathEdit.Text) <> '') and (not FileExists(Trim(CertificatePathEdit.Text))) then begin
    MsgBox('O arquivo do certificado digital nao foi encontrado no caminho informado.', mbError, MB_OK);
    WizardForm.ActiveControl := CertificatePathEdit;
    Exit;
  end;

  Result := True;
end;

function ValidatePrintingPage: Boolean;
var
  ConnectorValue: string;
  TcpPort: Integer;
begin
  Result := False;

  if not EnablePrintingCheck.Checked then begin
    Result := True;
    Exit;
  end;

  ConnectorValue := GetConnectorValue;
  if (ConnectorValue <> 'windows') and (ConnectorValue <> 'tcp') and (ConnectorValue <> 'pdf') then begin
    MsgBox('Escolha um conector de impressao valido.', mbError, MB_OK);
    WizardForm.ActiveControl := ConnectorCombo;
    Exit;
  end;

  if ConnectorValue = 'windows' then begin
    if Trim(PrinterNameCombo.Text) = '' then begin
      MsgBox('Informe a impressora do Windows para continuar.', mbError, MB_OK);
      WizardForm.ActiveControl := PrinterNameCombo;
      Exit;
    end;
  end;

  if ConnectorValue = 'tcp' then begin
    if Trim(TcpHostEdit.Text) = '' then begin
      MsgBox('Informe o IP ou hostname da impressora TCP.', mbError, MB_OK);
      WizardForm.ActiveControl := TcpHostEdit;
      Exit;
    end;

    TcpPort := StrToIntDef(Trim(TcpPortEdit.Text), 0);
    if TcpPort <= 0 then begin
      MsgBox('Informe uma porta TCP valida para a impressora.', mbError, MB_OK);
      WizardForm.ActiveControl := TcpPortEdit;
      Exit;
    end;
  end;

  Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = ConnectionPage.ID then begin
    Result := ValidateConnectionPage;
  end else if CurPageID = CertificatePage.ID then begin
    Result := ValidateCertificatePage;
  end else if CurPageID = PrintingPage.ID then begin
    Result := ValidatePrintingPage;
  end;
end;

procedure UpdateReadyPage;
var
  Summary: string;
  ConnectorValue: string;
begin
  Summary := 'Destino da instalacao:' + #13#10 + '  ' + WizardDirValue + #13#10 + #13#10;
  Summary := Summary + 'Conexao:' + #13#10;
  Summary := Summary + '  Backend: ' + Trim(BackendUrlEdit.Text) + #13#10;
  Summary := Summary + '  Codigo de ativacao: ' + Trim(ActivationCodeEdit.Text) + #13#10;
  Summary := Summary + '  Polling: ' + Trim(PollIntervalEdit.Text) + ' segundo(s)' + #13#10 + #13#10;

  Summary := Summary + 'Certificado digital:' + #13#10;
  if Trim(CertificatePathEdit.Text) = '' then begin
    Summary := Summary + '  Arquivo: nao informado' + #13#10;
  end else begin
    Summary := Summary + '  Arquivo: ' + Trim(CertificatePathEdit.Text) + #13#10;
    if Trim(CertificatePasswordEdit.Text) <> '' then begin
      Summary := Summary + '  Senha: informada' + #13#10;
    end else begin
      Summary := Summary + '  Senha: em branco' + #13#10;
    end;
  end;
  Summary := Summary + #13#10;

  Summary := Summary + 'Impressao:' + #13#10;
  if not EnablePrintingCheck.Checked then begin
    Summary := Summary + '  Impressao automatica: desativada';
  end else begin
    ConnectorValue := GetConnectorValue;
    Summary := Summary + '  Conector: ' + Uppercase(ConnectorValue) + #13#10;
    if ConnectorValue = 'windows' then begin
      Summary := Summary + '  Impressora: ' + Trim(PrinterNameCombo.Text);
    end else if ConnectorValue = 'tcp' then begin
      Summary := Summary + '  Destino TCP: ' + Trim(TcpHostEdit.Text) + ':' + Trim(TcpPortEdit.Text);
    end else begin
      Summary := Summary + '  Preview PDF: ' + GetPreviewOutputDir;
    end;
  end;

  WizardForm.ReadyMemo.Text := Summary;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpReady then begin
    UpdateReadyPage;
  end;
end;

function BuildSeedConfig: string;
var
  ConnectorValue: string;
  PrinterEnabledValue: string;
  PrinterNameValue: string;
  PrinterHostValue: string;
  PrinterPortValue: string;
  OutputPathValue: string;
  Content: string;
begin
  ConnectorValue := GetConnectorValue;

  if not EnablePrintingCheck.Checked then
    ConnectorValue := 'windows';

  PrinterEnabledValue := 'false';
  PrinterNameValue := '';
  PrinterHostValue := '127.0.0.1';
  PrinterPortValue := '9100';
  OutputPathValue := EscapeJson(GetPreviewOutputDir);

  if EnablePrintingCheck.Checked then
  begin
    PrinterEnabledValue := 'true';

    if ConnectorValue = 'windows' then
    begin
      PrinterNameValue := Trim(PrinterNameCombo.Text);
      PrinterHostValue := '';
    end
    else if ConnectorValue = 'tcp' then
    begin
      PrinterHostValue := Trim(TcpHostEdit.Text);
      PrinterPortValue := Trim(TcpPortEdit.Text);
      PrinterNameValue := '';
    end
    else
    begin
      PrinterHostValue := '';
      PrinterNameValue := '';
    end;
  end
  else
  begin
    PrinterHostValue := '';
    PrinterNameValue := '';
  end;

  SeedConfigPath := ExpandConstant('{tmp}\nimvo-agent-seed.json');

  Content := '{' + #13#10 +
    '  "backend": {' + #13#10 +
    '    "base_url": "' + EscapeJson(Trim(BackendUrlEdit.Text)) + '"' + #13#10 +
    '  },' + #13#10 +
    '  "agent": {' + #13#10 +
    '    "poll_interval_seconds": ' + IntToStr(StrToIntDef(Trim(PollIntervalEdit.Text), 3)) + #13#10 +
    '  },' + #13#10 +
    '  "certificate": {' + #13#10 +
    '    "path": "' + EscapeJson(Trim(CertificatePathEdit.Text)) + '",' + #13#10 +
    '    "password": "' + EscapeJson(Trim(CertificatePasswordEdit.Text)) + '"' + #13#10 +
    '  },' + #13#10 +
    '  "printer": {' + #13#10 +
    '    "enabled": ' + PrinterEnabledValue + ',' + #13#10 +
    '    "connector": "' + EscapeJson(ConnectorValue) + '",' + #13#10 +
    '    "name": "' + EscapeJson(PrinterNameValue) + '",' + #13#10 +
    '    "host": "' + EscapeJson(PrinterHostValue) + '",' + #13#10 +
    '    "port": ' + PrinterPortValue + ',' + #13#10 +
    '    "output_path": "' + OutputPathValue + '"' + #13#10 +
    '  },' + #13#10 +
    '  "local_api": {' + #13#10 +
    '    "enabled": true,' + #13#10 +
    '    "host": "127.0.0.1",' + #13#10 +
    '    "port": 18123' + #13#10 +
    '  }' + #13#10 +
    '}' + #13#10;

  SaveStringToFile(SeedConfigPath, Content, False);
  Result := SeedConfigPath;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  CommandLine: string;
  ResultCode: Integer;
  InstallDir: string;
  OutputText: string;
begin
  Result := '';
  NeedsRestart := False;

  InstallDir := RemoveBackslashUnlessRoot(WizardDirValue);
  InstallLogPath := ExpandConstant('{tmp}\nimvo-agent-install.log');
  BuildSeedConfig;

  CommandLine := AddQuotes(BootstrapExePath) +
    ' install --install-dir ' + AddQuotes(InstallDir) +
    ' --non-interactive --seed-config ' + AddQuotes(SeedConfigPath) +
    ' --activation-code ' + AddQuotes(Trim(ActivationCodeEdit.Text));

  if not RunHiddenCommand(CommandLine, InstallLogPath, ResultCode) then begin
    Result := 'Nao foi possivel iniciar a instalacao do Nimvo Fiscal Agent nesta maquina.';
    Exit;
  end;

  if ResultCode <> 0 then begin
    OutputText := Trim(ReadTextFileSafe(InstallLogPath));
    if OutputText = '' then begin
      OutputText := 'A instalacao falhou sem detalhes adicionais.';
    end;

    Result := 'Nao foi possivel concluir a instalacao do Nimvo Fiscal Agent.' + #13#10 + #13#10 + OutputText;
  end;
end;

procedure InitializeWizard;
var
  LabelControl: TNewStaticText;
begin
  ExtractTemporaryFile('nimvo-fiscal-agent.exe');
  ExtractTemporaryFile('nimvo.ico');
  ExtractTemporaryFile('nimvo-logo.png');

  BootstrapExePath := ExpandConstant('{tmp}\nimvo-fiscal-agent.exe');
  ConnectionPage := CreateCustomPage(wpSelectDir, 'Conexao do backend', 'Informe o backend central do Nimvo e o codigo de ativacao do tenant.');

  LabelControl := TNewStaticText.Create(ConnectionPage);
  LabelControl.Parent := ConnectionPage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(8);
  LabelControl.Width := ScaleX(520);
  LabelControl.Caption := 'URL do backend do Nimvo';
  BackendUrlEdit := TNewEdit.Create(ConnectionPage);
  BackendUrlEdit.Parent := ConnectionPage.Surface;
  BackendUrlEdit.Left := ScaleX(0);
  BackendUrlEdit.Top := ScaleY(28);
  BackendUrlEdit.Width := ScaleX(520);
  BackendUrlEdit.Text := 'https://admin.nimvo.com.br';

  LabelControl := TNewStaticText.Create(ConnectionPage);
  LabelControl.Parent := ConnectionPage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(76);
  LabelControl.Width := ScaleX(520);
  LabelControl.Caption := 'Codigo de ativacao do tenant';
  ActivationCodeEdit := TNewEdit.Create(ConnectionPage);
  ActivationCodeEdit.Parent := ConnectionPage.Surface;
  ActivationCodeEdit.Left := ScaleX(0);
  ActivationCodeEdit.Top := ScaleY(96);
  ActivationCodeEdit.Width := ScaleX(280);

  LabelControl := TNewStaticText.Create(ConnectionPage);
  LabelControl.Parent := ConnectionPage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(144);
  LabelControl.Width := ScaleX(520);
  LabelControl.Caption := 'Polling em segundos';
  PollIntervalEdit := TNewEdit.Create(ConnectionPage);
  PollIntervalEdit.Parent := ConnectionPage.Surface;
  PollIntervalEdit.Left := ScaleX(0);
  PollIntervalEdit.Top := ScaleY(164);
  PollIntervalEdit.Width := ScaleX(120);
  PollIntervalEdit.Text := '3';

  LabelControl := TNewStaticText.Create(ConnectionPage);
  LabelControl.Parent := ConnectionPage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(210);
  LabelControl.Width := ScaleX(560);
  LabelControl.AutoSize := False;
  LabelControl.Height := ScaleY(40);
  LabelControl.Caption := 'O instalador troca o codigo de ativacao por credenciais internas e deixa o agente pronto para rodar em segundo plano.';

  CertificatePage := CreateCustomPage(ConnectionPage.ID, 'Certificado digital', 'Informe o local do certificado A1 e a senha para salvar essa configuracao no agente.');

  LabelControl := TNewStaticText.Create(CertificatePage);
  LabelControl.Parent := CertificatePage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(8);
  LabelControl.Width := ScaleX(560);
  LabelControl.Caption := 'Arquivo do certificado digital (.pfx ou .p12)';

  CertificatePathEdit := TNewEdit.Create(CertificatePage);
  CertificatePathEdit.Parent := CertificatePage.Surface;
  CertificatePathEdit.Left := ScaleX(0);
  CertificatePathEdit.Top := ScaleY(28);
  CertificatePathEdit.Width := ScaleX(520);

  LabelControl := TNewStaticText.Create(CertificatePage);
  LabelControl.Parent := CertificatePage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(76);
  LabelControl.Width := ScaleX(560);
  LabelControl.Caption := 'Senha do certificado digital';

  CertificatePasswordEdit := TPasswordEdit.Create(CertificatePage);
  CertificatePasswordEdit.Parent := CertificatePage.Surface;
  CertificatePasswordEdit.Left := ScaleX(0);
  CertificatePasswordEdit.Top := ScaleY(96);
  CertificatePasswordEdit.Width := ScaleX(280);

  LabelControl := TNewStaticText.Create(CertificatePage);
  LabelControl.Parent := CertificatePage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(144);
  LabelControl.Width := ScaleX(560);
  LabelControl.Height := ScaleY(56);
  LabelControl.AutoSize := False;
  LabelControl.Caption := 'Esse passo e opcional, mas ja deixa o agente pronto para localizar o certificado fiscal da maquina. Se quiser instalar primeiro e configurar depois, deixe os campos em branco.';

  PrintingPage := CreateCustomPage(CertificatePage.ID, 'Impressao local', 'Escolha como o Nimvo vai gerar o cupom na maquina.');

  EnablePrintingCheck := TNewCheckBox.Create(PrintingPage);
  EnablePrintingCheck.Parent := PrintingPage.Surface;
  EnablePrintingCheck.Left := ScaleX(0);
  EnablePrintingCheck.Top := ScaleY(8);
  EnablePrintingCheck.Width := ScaleX(360);
  EnablePrintingCheck.Caption := 'Ativar impressao automatica do cupom';
  EnablePrintingCheck.Checked := True;
  EnablePrintingCheck.OnClick := @EnablePrintingChanged;

  LabelControl := TNewStaticText.Create(PrintingPage);
  LabelControl.Parent := PrintingPage.Surface;
  LabelControl.Left := ScaleX(0);
  LabelControl.Top := ScaleY(44);
  LabelControl.Width := ScaleX(240);
  LabelControl.Caption := 'Conector da impressora';
  ConnectorCombo := TNewComboBox.Create(PrintingPage);
  ConnectorCombo.Parent := PrintingPage.Surface;
  ConnectorCombo.Left := ScaleX(0);
  ConnectorCombo.Top := ScaleY(64);
  ConnectorCombo.Width := ScaleX(220);
  ConnectorCombo.Style := csDropDownList;
  ConnectorCombo.Items.Add('windows');
  ConnectorCombo.Items.Add('tcp');
  ConnectorCombo.Items.Add('pdf');
  ConnectorCombo.ItemIndex := 0;
  ConnectorCombo.OnChange := @ConnectorChanged;

  PrinterNameLabel := TNewStaticText.Create(PrintingPage);
  PrinterNameLabel.Parent := PrintingPage.Surface;
  PrinterNameLabel.Left := ScaleX(0);
  PrinterNameLabel.Top := ScaleY(110);
  PrinterNameLabel.Width := ScaleX(280);
  PrinterNameLabel.Caption := 'Impressora do Windows';

  PrinterNameCombo := TNewComboBox.Create(PrintingPage);
  PrinterNameCombo.Parent := PrintingPage.Surface;
  PrinterNameCombo.Left := ScaleX(0);
  PrinterNameCombo.Top := ScaleY(130);
  PrinterNameCombo.Width := ScaleX(420);
  PrinterNameCombo.Style := csDropDown;

  RefreshPrintersButton := TNewButton.Create(PrintingPage);
  RefreshPrintersButton.Parent := PrintingPage.Surface;
  RefreshPrintersButton.Left := ScaleX(432);
  RefreshPrintersButton.Top := ScaleY(128);
  RefreshPrintersButton.Width := ScaleX(110);
  RefreshPrintersButton.Height := ScaleY(26);
  RefreshPrintersButton.Caption := 'Atualizar';
  RefreshPrintersButton.OnClick := @RefreshPrintersClicked;

  PrinterHintLabel := TNewStaticText.Create(PrintingPage);
  PrinterHintLabel.Parent := PrintingPage.Surface;
  PrinterHintLabel.Left := ScaleX(0);
  PrinterHintLabel.Top := ScaleY(164);
  PrinterHintLabel.Width := ScaleX(560);
  PrinterHintLabel.Height := ScaleY(36);
  PrinterHintLabel.AutoSize := False;

  TcpHostLabel := TNewStaticText.Create(PrintingPage);
  TcpHostLabel.Parent := PrintingPage.Surface;
  TcpHostLabel.Left := ScaleX(0);
  TcpHostLabel.Top := ScaleY(110);
  TcpHostLabel.Width := ScaleX(280);
  TcpHostLabel.Caption := 'IP ou hostname da impressora';

  TcpHostEdit := TNewEdit.Create(PrintingPage);
  TcpHostEdit.Parent := PrintingPage.Surface;
  TcpHostEdit.Left := ScaleX(0);
  TcpHostEdit.Top := ScaleY(130);
  TcpHostEdit.Width := ScaleX(280);
  TcpHostEdit.Text := '127.0.0.1';

  TcpPortLabel := TNewStaticText.Create(PrintingPage);
  TcpPortLabel.Parent := PrintingPage.Surface;
  TcpPortLabel.Left := ScaleX(300);
  TcpPortLabel.Top := ScaleY(110);
  TcpPortLabel.Width := ScaleX(120);
  TcpPortLabel.Caption := 'Porta TCP';

  TcpPortEdit := TNewEdit.Create(PrintingPage);
  TcpPortEdit.Parent := PrintingPage.Surface;
  TcpPortEdit.Left := ScaleX(300);
  TcpPortEdit.Top := ScaleY(130);
  TcpPortEdit.Width := ScaleX(120);
  TcpPortEdit.Text := '9100';

  PdfHintLabel := TNewStaticText.Create(PrintingPage);
  PdfHintLabel.Parent := PrintingPage.Surface;
  PdfHintLabel.Left := ScaleX(0);
  PdfHintLabel.Top := ScaleY(110);
  PdfHintLabel.Width := ScaleX(560);
  PdfHintLabel.Height := ScaleY(48);
  PdfHintLabel.AutoSize := False;
  PdfHintLabel.Caption := 'O modo PDF gera cupons de exemplo para validacao visual. Os arquivos ficam em ' + GetPreviewOutputDir + '.';

  PopulatePrinterList;
  if PrinterNameCombo.Items.Count = 0 then begin
    ConnectorCombo.ItemIndex := 2;
  end;
  UpdatePrintingControls;
end;
