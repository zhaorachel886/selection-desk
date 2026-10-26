param([int]$X,[int]$Y)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NativeMouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
'@
[NativeMouse]::SetCursorPos($X,$Y) | Out-Null
Start-Sleep -Milliseconds 180
for($i=0;$i -lt 2;$i++) {
  [NativeMouse]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  [NativeMouse]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 90
}
