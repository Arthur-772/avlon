using System.Runtime.InteropServices;
using System.Text;

namespace BigFolder.Services;

internal static class NativeMethods
{
    private const uint SHGFI_SYSICONINDEX = 0x0000_4000;
    private const uint SHGFI_LARGEICON = 0x0000_0000;
    private const uint ILD_TRANSPARENT = 0x0000_0001;
    private const int SHIL_EXTRALARGE = 0x0000_0002;
    private const uint SLGP_RAWPATH = 0x0000_0004;
    private const uint STGM_READ = 0x0000_0000;

    private static readonly Guid ShellLinkClassId = new("00021401-0000-0000-C000-000000000046");
    private static readonly Guid ShellLinkId = new("000214F9-0000-0000-C000-000000000046");
    private static readonly Guid PersistFileId = new("0000010B-0000-0000-C000-000000000046");
    private static readonly Guid ImageListId = new("46EB5926-582E-4017-9FDF-E8998D80B5F5");

    public static ShellLinkInfo ReadShortcut(string shortcutPath)
    {
        IShellLinkW? link = null;
        try
        {
            link = (IShellLinkW)Activator.CreateInstance(typeof(ShellLinkClass))!;
            var persistFile = (IPersistFile)link;
            persistFile.Load(shortcutPath, STGM_READ);

            var target = new StringBuilder(1024);
            var arguments = new StringBuilder(1024);
            var workingDirectory = new StringBuilder(1024);
            var iconPath = new StringBuilder(1024);

            link.GetPath(target, target.Capacity, IntPtr.Zero, SLGP_RAWPATH);
            link.GetArguments(arguments, arguments.Capacity);
            link.GetWorkingDirectory(workingDirectory, workingDirectory.Capacity);
            link.GetIconLocation(iconPath, iconPath.Capacity, out var iconIndex);

            return new ShellLinkInfo(
                target.ToString(),
                arguments.ToString(),
                workingDirectory.ToString(),
                iconPath.ToString(),
                iconIndex);
        }
        finally
        {
            if (link is not null)
            {
                _ = Marshal.ReleaseComObject(link);
            }
        }
    }

    public static IntPtr GetSystemIconIndexIcon(string path)
    {
        var info = default(SHFILEINFOW);
        var result = SHGetFileInfo(path, 0, ref info, (uint)Marshal.SizeOf<SHFILEINFOW>(), SHGFI_SYSICONINDEX);
        if (result == IntPtr.Zero)
        {
            return IntPtr.Zero;
        }

        if (SHGetImageList(SHIL_EXTRALARGE, ImageListId, out var systemImageList) != 0 || systemImageList is null)
        {
            return IntPtr.Zero;
        }

        try
        {
            systemImageList.GetIcon(info.iIcon, ILD_TRANSPARENT, out var iconHandle);
            return iconHandle;
        }
        finally
        {
            _ = Marshal.ReleaseComObject(systemImageList);
        }
    }

    public static IntPtr ExtractLargeIcon(string path, int iconIndex)
    {
        const uint largeSize = 96;
        const uint smallSize = 48;
        var size = largeSize | (smallSize << 16);
        var result = SHDefExtractIcon(path, iconIndex, 0, out var iconHandle, IntPtr.Zero, size);
        return result == 0 ? iconHandle : IntPtr.Zero;
    }

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr hIcon);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr SHGetFileInfo(
        string path,
        uint fileAttributes,
        ref SHFILEINFOW fileInfo,
        uint fileInfoSize,
        uint flags);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SHGetImageList(int imageListType, Guid interfaceId, out IImageList imageList);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SHDefExtractIcon(
        string iconFile,
        int iconIndex,
        uint flags,
        out IntPtr largeIcon,
        IntPtr smallIcon,
        uint iconSize);

    [ComImport]
    [Guid("00021401-0000-0000-C000-000000000046")]
    private sealed class ShellLinkClass
    {
    }

    [ComImport]
    [Guid("000214F9-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellLinkW
    {
        void GetPath(
            [MarshalAs(UnmanagedType.LPWStr)] StringBuilder target,
            int targetLength,
            IntPtr findData,
            uint flags);

        void GetIDList(out IntPtr pointerIdList);

        void SetIDList(IntPtr pointerIdList);

        void GetDescription([MarshalAs(UnmanagedType.LPWStr)] StringBuilder description, int length);

        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string description);

        void GetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] StringBuilder directory, int length);

        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string directory);

        void GetArguments([MarshalAs(UnmanagedType.LPWStr)] StringBuilder arguments, int length);

        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string arguments);

        void GetHotkey(out short hotkey);

        void SetHotkey(short hotkey);

        void GetShowCmd(out int showCommand);

        void SetShowCmd(int showCommand);

        void GetIconLocation(
            [MarshalAs(UnmanagedType.LPWStr)] StringBuilder iconPath,
            int length,
            out int iconIndex);

        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string iconPath, int iconIndex);

        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string relativePath);

        void Resolve(IntPtr hwnd, uint flags);

        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }

    [ComImport]
    [Guid("0000010B-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPersistFile
    {
        void GetClassID(out Guid classId);

        void IsDirty();

        void Load([MarshalAs(UnmanagedType.LPWStr)] string fileName, uint mode);

        void Save([MarshalAs(UnmanagedType.LPWStr)] string fileName, bool remember);

        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string fileName);

        void GetCurFile(out IntPtr fileName);
    }

    [ComImport]
    [Guid("46EB5926-582E-4017-9FDF-E8998D80B5F5")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IImageList
    {
        int Add(IntPtr image, IntPtr mask, out int index);

        int ReplaceIcon(int index, IntPtr icon, out int newIndex);

        int SetOverlayImage(int image, int overlay);

        int Replace(int index, IntPtr image, IntPtr mask);

        int AddMasked(IntPtr image, uint maskColor, out int index);

        int Draw(IntPtr drawParameters);

        int Remove(int index);

        int GetIcon(int index, uint flags, out IntPtr icon);
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct SHFILEINFOW
    {
        public IntPtr hIcon;

        public int iIcon;

        public uint dwAttributes;

        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szDisplayName;

        public uint dwFileType;
    }
}
