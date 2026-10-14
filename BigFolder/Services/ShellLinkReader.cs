using System.IO;
using System.Runtime.InteropServices;
using BigFolder.Models;

namespace BigFolder.Services;

public sealed class ShellLinkReader : IShellItemInspector
{
    public FolderItem? CreateItem(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        try
        {
            var fullPath = Path.GetFullPath(path);
            if (!File.Exists(fullPath) && !Directory.Exists(fullPath))
            {
                return null;
            }

            var displayName = Path.GetFileName(fullPath);
            if (string.Equals(Path.GetExtension(fullPath), ".lnk", StringComparison.OrdinalIgnoreCase))
            {
                displayName = Path.GetFileNameWithoutExtension(fullPath);
            }

            var link = ReadShortcut(fullPath);
            var targetPath = !string.IsNullOrWhiteSpace(link.TargetPath) ? link.TargetPath : fullPath;

            return new FolderItem
            {
                DisplayName = displayName,
                TargetPath = targetPath,
                Arguments = link.Arguments,
                WorkingDirectory = link.WorkingDirectory,
                IconIndex = link.IconIndex,
            };
        }
        catch (IOException)
        {
            return null;
        }
        catch (UnauthorizedAccessException)
        {
            return null;
        }
        catch (COMException)
        {
            return null;
        }
    }

    private static ShellLinkInfo ReadShortcut(string path)
    {
        try
        {
            return NativeMethods.ReadShortcut(path);
        }
        catch (COMException)
        {
            return new ShellLinkInfo(path, string.Empty, string.Empty, string.Empty, 0);
        }
    }
}
