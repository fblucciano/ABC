Option Explicit
' ============================================================
'  VenusP Planning Report - Lancador OFFLINE para Windows
'  Basta dar dois cliques neste arquivo. Ele abre o app
'  venusp-planning-report.html (que deve estar na MESMA pasta)
'  no navegador padrao. Nao precisa de internet.
' ============================================================
Dim oShell, oFSO, sDir, sFile
Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")
sDir = oFSO.GetParentFolderName(WScript.ScriptFullName)
sFile = sDir & "\venusp-planning-report.html"
If oFSO.FileExists(sFile) Then
    oShell.Run """" & sFile & """", 1, False
Else
    MsgBox "Arquivo venusp-planning-report.html nao encontrado nesta pasta." & vbCrLf & "Mantenha este lancador na mesma pasta do app.", vbCritical, "VenusP Planning Report"
End If
