using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using BigFolder.Models;

namespace BigFolder.Services;

public sealed class ShellIconProvider : IIconProvider
{
    public ImageSource? GetIcon(FolderItem item)
    {
        if (string.IsNullOrWhiteSpace(item.TargetPath))
        {
            return null;
        }

        var iconHandle = GetIconHandle(item);
        if (iconHandle == IntPtr.Zero)
        {
            return null;
        }

        try
        {
            var image = Imaging.CreateBitmapSourceFromHIcon(
                iconHandle,
                Int32Rect.Empty,
                BitmapSizeOptions.FromEmptyOptions());
            image.Freeze();
            return image;
        }
        catch (ExternalException)
        {
            return null;
        }
        finally
        {
            _ = NativeMethods.DestroyIcon(iconHandle);
        }
    }

    private static IntPtr GetIconHandle(FolderItem item)
    {
        var target = item.TargetPath;
        var linkInfo = (ShellLinkInfo?)null;

        if (IsShortcut(target))
        {
            try
            {
                linkInfo = NativeMethods.ReadShortcut(target);
                if (!string.IsNullOrWhiteSpace(linkInfo.IconPath))
                {
                    var icon = NativeMethods.ExtractLargeIcon(linkInfo.IconPath, linkInfo.IconIndex);
                    if (icon != IntPtr.Zero)
                    {
                        return icon;
                    }
                }
            }
            catch (COMException)
            {
            }
        }

        var shellIcon = NativeMethods.GetSystemIconIndexIcon(target);
        if (shellIcon != IntPtr.Zero)
        {
            return shellIcon;
        }

        if (linkInfo is not null && !string.IsNullOrWhiteSpace(linkInfo.TargetPath))
        {
            shellIcon = NativeMethods.GetSystemIconIndexIcon(linkInfo.TargetPath);
            if (shellIcon != IntPtr.Zero)
            {
                return shellIcon;
            }

            if (File.Exists(linkInfo.TargetPath))
            {
                var iconIndex = item.IconIndex;
                if (string.Equals(Path.GetExtension(linkInfo.TargetPath), ".exe", StringComparison.OrdinalIgnoreCase)
                    && iconIndex == 0)
                {
                    iconIndex = 0;
                }

                return NativeMethods.ExtractLargeIcon(linkInfo.TargetPath, iconIndex);
            }
        }

        if (File.Exists(target))
        {
            return NativeMethods.ExtractLargeIcon(target, item.IconIndex);
        }

        return IntPtr.Zero;
    }

    private static bool IsShortcut(string path)
    {
        return string.Equals(Path.GetExtension(path), ".lnk", StringComparison.OrdinalIgnoreCase);
    }
}
