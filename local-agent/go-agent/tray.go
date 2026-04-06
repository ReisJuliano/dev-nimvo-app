package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

const (
	wmApp             = 0x8000
	wmTrayIcon        = wmApp + 1
	wmCommand         = 0x0111
	wmDestroy         = 0x0002
	wmClose           = 0x0010
	wmRButtonUp       = 0x0205
	wmLButtonDblClk   = 0x0203
	tpmRightButton    = 0x0002
	mfString          = 0x0000
	imageIcon         = 1
	lrLoadFromFile    = 0x0010
	lrDefaultSize     = 0x0040
	nimAdd            = 0x00000000
	nimDelete         = 0x00000002
	nifMessage        = 0x00000001
	nifIcon           = 0x00000002
	nifTip            = 0x00000004
	idiApplication    = 32512
	menuStatusID      = 1001
	menuPrintTestID   = 1002
	menuExitID        = 1003
	mbOK              = 0x00000000
	mbIconInformation = 0x00000040
	mbIconError       = 0x00000010
)

var (
	user32DLL            = syscall.NewLazyDLL("user32.dll")
	shell32DLL           = syscall.NewLazyDLL("shell32.dll")
	kernel32DLL          = syscall.NewLazyDLL("kernel32.dll")
	procRegisterClassExW = user32DLL.NewProc("RegisterClassExW")
	procCreateWindowExW  = user32DLL.NewProc("CreateWindowExW")
	procDefWindowProcW   = user32DLL.NewProc("DefWindowProcW")
	procDestroyWindow    = user32DLL.NewProc("DestroyWindow")
	procDispatchMessageW = user32DLL.NewProc("DispatchMessageW")
	procGetCursorPos     = user32DLL.NewProc("GetCursorPos")
	procGetMessageW      = user32DLL.NewProc("GetMessageW")
	procLoadIconW        = user32DLL.NewProc("LoadIconW")
	procLoadImageW       = user32DLL.NewProc("LoadImageW")
	procMessageBoxW      = user32DLL.NewProc("MessageBoxW")
	procPostQuitMessage  = user32DLL.NewProc("PostQuitMessage")
	procSetForegroundWnd = user32DLL.NewProc("SetForegroundWindow")
	procTrackPopupMenu   = user32DLL.NewProc("TrackPopupMenu")
	procTranslateMessage = user32DLL.NewProc("TranslateMessage")
	procCreatePopupMenu  = user32DLL.NewProc("CreatePopupMenu")
	procAppendMenuW      = user32DLL.NewProc("AppendMenuW")
	procDestroyMenu      = user32DLL.NewProc("DestroyMenu")
	procDestroyIcon      = user32DLL.NewProc("DestroyIcon")
	procShellNotifyIconW = shell32DLL.NewProc("Shell_NotifyIconW")
	procGetModuleHandleW = kernel32DLL.NewProc("GetModuleHandleW")
	activeTrayController *trayController
)

type trayController struct {
	options       runtimeOptions
	server        *httpServerHandle
	iconHandle    uintptr
	windowHandle  uintptr
	runtimeErr    error
	exitRequested bool
}

type notifyIconData struct {
	CbSize           uint32
	HWnd             uintptr
	UID              uint32
	UFlags           uint32
	UCallbackMessage uint32
	HIcon            uintptr
	SzTip            [128]uint16
	DwState          uint32
	DwStateMask      uint32
	SzInfo           [256]uint16
	UTimeoutOrVer    uint32
	SzInfoTitle      [64]uint16
	DwInfoFlags      uint32
	GuidItem         [16]byte
	HBalloonIcon     uintptr
}

type wndClassEx struct {
	CbSize     uint32
	Style      uint32
	WndProc    uintptr
	ClsExtra   int32
	WndExtra   int32
	Instance   uintptr
	Icon       uintptr
	Cursor     uintptr
	Background uintptr
	MenuName   *uint16
	ClassName  *uint16
	IconSmall  uintptr
}

type point struct {
	X int32
	Y int32
}

type msg struct {
	HWnd     uintptr
	Message  uint32
	WParam   uintptr
	LParam   uintptr
	Time     uint32
	Pt       point
	LPrivate uint32
}

func runTray(args []string) error {
	options, err := parseLocalAgentRuntimeOptions("tray", args)
	if err != nil {
		return err
	}

	config, err := loadNormalizedAgentConfig(options.ConfigPath)
	if err != nil {
		return err
	}

	var server *httpServerHandle
	if config.LocalAPI.Enabled {
		server, err = startLocalAPIServer(config, &localAgentHTTPServer{
			configPath: options.ConfigPath,
		})
		if err != nil {
			return err
		}
	}

	controller := &trayController{
		options: options,
		server:  server,
	}
	activeTrayController = controller
	defer func() {
		activeTrayController = nil
	}()

	runtimeErrCh := make(chan error, 1)
	go func() {
		runtimeErrCh <- runHeartbeatLoop(options)
	}()

	if err := controller.runMessageLoop(); err != nil {
		if server != nil {
			_ = server.Close()
		}
		return err
	}

	if server != nil {
		_ = server.Close()
	}

	select {
	case runtimeErr := <-runtimeErrCh:
		if runtimeErr != nil && !controller.exitRequested {
			return runtimeErr
		}
	default:
	}

	return nil
}

func (controller *trayController) runMessageLoop() error {
	instance, _, _ := procGetModuleHandleW.Call(0)
	className, _ := syscall.UTF16PtrFromString("NimvoFiscalAgentTrayWindow")
	windowTitle, _ := syscall.UTF16PtrFromString("Nimvo Fiscal Agent")

	iconHandle, err := loadTrayIcon()
	if err != nil {
		return err
	}
	controller.iconHandle = iconHandle

	class := wndClassEx{
		CbSize:    uint32(unsafe.Sizeof(wndClassEx{})),
		WndProc:   syscall.NewCallback(trayWindowProc),
		Instance:  instance,
		ClassName: className,
		Icon:      iconHandle,
		IconSmall: iconHandle,
	}

	if result, _, callErr := procRegisterClassExW.Call(uintptr(unsafe.Pointer(&class))); result == 0 {
		return fmt.Errorf("nao foi possivel registrar a janela da bandeja: %v", callErr)
	}

	windowHandle, _, callErr := procCreateWindowExW.Call(
		0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(windowTitle)),
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		instance,
		0,
	)
	if windowHandle == 0 {
		return fmt.Errorf("nao foi possivel criar a janela oculta da bandeja: %v", callErr)
	}
	controller.windowHandle = windowHandle

	if err := controller.addTrayIcon(); err != nil {
		return err
	}
	defer controller.cleanupTray()

	message := msg{}
	for {
		result, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0)
		if int32(result) == -1 {
			return fmt.Errorf("falha ao ler mensagens da bandeja do Windows")
		}
		if result == 0 {
			break
		}

		procTranslateMessage.Call(uintptr(unsafe.Pointer(&message)))
		procDispatchMessageW.Call(uintptr(unsafe.Pointer(&message)))
	}

	return nil
}

func (controller *trayController) addTrayIcon() error {
	data := notifyIconData{
		CbSize:           uint32(unsafe.Sizeof(notifyIconData{})),
		HWnd:             controller.windowHandle,
		UID:              1,
		UFlags:           nifMessage | nifIcon | nifTip,
		UCallbackMessage: wmTrayIcon,
		HIcon:            controller.iconHandle,
	}
	copy(data.SzTip[:], syscall.StringToUTF16("Nimvo Fiscal Agent"))

	if result, _, callErr := procShellNotifyIconW.Call(nimAdd, uintptr(unsafe.Pointer(&data))); result == 0 {
		return fmt.Errorf("nao foi possivel adicionar o icone da bandeja: %v", callErr)
	}

	return nil
}

func (controller *trayController) cleanupTray() {
	if controller.windowHandle != 0 {
		data := notifyIconData{
			CbSize: uint32(unsafe.Sizeof(notifyIconData{})),
			HWnd:   controller.windowHandle,
			UID:    1,
		}
		procShellNotifyIconW.Call(nimDelete, uintptr(unsafe.Pointer(&data)))
		procDestroyWindow.Call(controller.windowHandle)
		controller.windowHandle = 0
	}

	if controller.iconHandle != 0 {
		procDestroyIcon.Call(controller.iconHandle)
		controller.iconHandle = 0
	}
}

func (controller *trayController) showContextMenu() {
	menuHandle, _, _ := procCreatePopupMenu.Call()
	if menuHandle == 0 {
		return
	}
	defer procDestroyMenu.Call(menuHandle)

	appendMenuString(menuHandle, menuStatusID, "Status")
	appendMenuString(menuHandle, menuPrintTestID, "Imprimir teste")
	appendMenuString(menuHandle, menuExitID, "Sair")

	cursor := point{}
	procGetCursorPos.Call(uintptr(unsafe.Pointer(&cursor)))
	procSetForegroundWnd.Call(controller.windowHandle)
	procTrackPopupMenu.Call(
		menuHandle,
		tpmRightButton,
		uintptr(cursor.X),
		uintptr(cursor.Y),
		0,
		controller.windowHandle,
		0,
	)
}

func (controller *trayController) showStatus() {
	config, err := loadNormalizedAgentConfig(controller.options.ConfigPath)
	if err != nil {
		controller.showMessage("Nimvo Fiscal Agent", err.Error(), mbIconError)
		return
	}

	lines := []string{
		"Agente local do Nimvo em execucao.",
		"",
		fmt.Sprintf("Backend: %s", strings.TrimSpace(config.Backend.BaseURL)),
		fmt.Sprintf("Impressora: %s", strings.TrimSpace(printerTarget(config.Printer))),
		fmt.Sprintf("API local: %s", localAPIBaseURL(config)),
		fmt.Sprintf("Polling: %ds", maxInt(1, config.Agent.PollInterval)),
	}

	controller.showMessage("Nimvo Fiscal Agent", strings.Join(lines, "\n"), mbIconInformation)
}

func (controller *trayController) printTest() {
	config, err := loadNormalizedAgentConfig(controller.options.ConfigPath)
	if err != nil {
		controller.showMessage("Nimvo Fiscal Agent", err.Error(), mbIconError)
		return
	}

	err = printTestReceipt(config.Printer, printTestRequest{
		StoreName: "Nimvo",
		Message:   "Teste enviado pelo icone da bandeja do agente local.",
	})
	if err != nil {
		controller.showMessage("Nimvo Fiscal Agent", err.Error(), mbIconError)
		return
	}

	controller.showMessage("Nimvo Fiscal Agent", "Teste enviado para a impressora configurada.", mbIconInformation)
}

func (controller *trayController) requestExit() {
	controller.exitRequested = true
	procDestroyWindow.Call(controller.windowHandle)
}

func (controller *trayController) showMessage(title, body string, flags uintptr) {
	titlePtr, _ := syscall.UTF16PtrFromString(title)
	bodyPtr, _ := syscall.UTF16PtrFromString(body)
	procMessageBoxW.Call(controller.windowHandle, uintptr(unsafe.Pointer(bodyPtr)), uintptr(unsafe.Pointer(titlePtr)), mbOK|flags)
}

func appendMenuString(menuHandle uintptr, itemID uintptr, text string) {
	textPtr, _ := syscall.UTF16PtrFromString(text)
	procAppendMenuW.Call(menuHandle, mfString, itemID, uintptr(unsafe.Pointer(textPtr)))
}

func loadTrayIcon() (uintptr, error) {
	iconPath := trayIconPath()
	if iconPath != "" && fileExists(iconPath) {
		pathPtr, _ := syscall.UTF16PtrFromString(iconPath)
		iconHandle, _, _ := procLoadImageW.Call(
			0,
			uintptr(unsafe.Pointer(pathPtr)),
			imageIcon,
			0,
			0,
			lrLoadFromFile|lrDefaultSize,
		)
		if iconHandle != 0 {
			return iconHandle, nil
		}
	}

	iconHandle, _, _ := procLoadIconW.Call(0, idiApplication)
	if iconHandle == 0 {
		return 0, fmt.Errorf("nao foi possivel carregar o icone da bandeja do Windows")
	}

	return iconHandle, nil
}

func trayIconPath() string {
	exePath, err := os.Executable()
	if err != nil {
		return ""
	}

	return filepath.Clean(filepath.Join(filepath.Dir(exePath), "..", "assets", "nimvo.ico"))
}

func trayWindowProc(windowHandle uintptr, message uint32, wParam, lParam uintptr) uintptr {
	controller := activeTrayController
	if controller == nil {
		result, _, _ := procDefWindowProcW.Call(windowHandle, uintptr(message), wParam, lParam)
		return result
	}

	switch message {
	case wmTrayIcon:
		switch uint32(lParam) {
		case wmRButtonUp:
			controller.showContextMenu()
			return 0
		case wmLButtonDblClk:
			controller.showStatus()
			return 0
		}
	case wmCommand:
		switch wParam & 0xffff {
		case menuStatusID:
			controller.showStatus()
			return 0
		case menuPrintTestID:
			go controller.printTest()
			return 0
		case menuExitID:
			controller.requestExit()
			return 0
		}
	case wmClose:
		controller.requestExit()
		return 0
	case wmDestroy:
		procPostQuitMessage.Call(0)
		return 0
	}

	result, _, _ := procDefWindowProcW.Call(windowHandle, uintptr(message), wParam, lParam)
	return result
}
