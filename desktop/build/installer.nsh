!macro customInstall
  ; Ipchat sunucu ve kesif portlari (yalnizca bu iki port)
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Ipchat"'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Ipchat" dir=in action=allow protocol=TCP localport=3000 profile=any'
  nsExec::Exec 'netsh advfirewall firewall add rule name="Ipchat" dir=in action=allow protocol=UDP localport=41234 profile=any'
!macroend

!macro customUnInstall
  ; Calisan uygulamayi ve onun sunucu alt surecini kapat
  nsExec::Exec 'taskkill /F /IM "${APP_EXECUTABLE_FILENAME}"'

  ; Guvenlik duvari kurallari ve otomatik baslatma: guncelleme sirasinda dokunma
  ${IfNot} ${isUpdated}
    nsExec::Exec 'netsh advfirewall firewall delete rule name="Ipchat"'
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Ipchat"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.ipchat-desktop"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Ipchat"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.ipchat.desktop"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ipchat-desktop"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Ipchat"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "electron.app.ipchat-desktop"
  ${EndIf}

  ; Mesaj verisi: guncellemede ve sessiz kaldirmada dokunma, aksi halde bir kez sor (varsayilan Evet)
  ${IfNot} ${isUpdated}
  ${AndIfNot} ${Silent}
    SetShellVarContext current
    StrCpy $0 "Sohbet geçmişi ve ayarlar da silinsin mi?$\r$\n$\r$\nBu işlem geri alınamaz."
    IfFileExists "$APPDATA\ipchat-desktop\server-data\*.*" 0 +2
      StrCpy $0 "$0$\r$\n$\r$\nBu bilgisayar sunucu olarak kullanıldı: tüm kullanıcıların hesapları ve mesajları da silinecek."
    MessageBox MB_YESNO|MB_DEFBUTTON1|MB_ICONQUESTION "$0" IDNO ipchat_keep_data
      RMDir /r "$APPDATA\ipchat-desktop"
    ipchat_keep_data:
    SetShellVarContext all
  ${EndIf}
!macroend
