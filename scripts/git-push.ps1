# Git Push Helper for NCAMart
# Automatically extracts authenticated token from Windows Credential Manager and pushes to origin main

$script = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class GitHubAuthHelper {
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr credentialPtr);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string GetToken() {
        IntPtr credPtr;
        if (CredRead("GitHub - https://api.github.com/MdRamzanHossain", 1, 0, out credPtr)) {
            var cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            byte[] bytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);
            CredFree(credPtr);
            return Encoding.UTF8.GetString(bytes);
        }
        return null;
    }
}
"@

Add-Type -TypeDefinition $script -ErrorAction SilentlyContinue
$tok = [GitHubAuthHelper]::GetToken()

$gitPath = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $gitPath)) {
    $gitPath = "git"
}

if ($tok) {
    $authUrl = "https://MdRamzanHossain:$($tok)@github.com/MdRamzanHossain/ncamart.git"
    & $gitPath push $authUrl main
} else {
    & $gitPath push origin main
}
