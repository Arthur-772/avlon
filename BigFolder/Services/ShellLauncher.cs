using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using BigFolder.Models;

namespace BigFolder.Services;

public sealed class ShellLauncher : IShellLauncher
{
    public void Launch(FolderItem item)
    {
        if (string.IsNullOrWhiteSpace(item.TargetPath))
        {
            throw new InvalidOperationException("The item does not contain a target path.");
        }

        var workingDirectory = string.IsNullOrWhiteSpace(item.WorkingDirectory)
            ? string.Empty
            : item.WorkingDirectory;
        if (workingDirectory.Length == 0 || !Directory.Exists(workingDirectory))
        {
            workingDirectory = GetDefaultWorkingDirectory(item.TargetPath);
        }

        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = item.TargetPath,
            Arguments = item.Arguments,
            WorkingDirectory = workingDirectory,
            UseShellExecute = true,
        });
    }

    private static string GetDefaultWorkingDirectory(string targetPath)
    {
        if (File.Exists(targetPath))
        {
            return Path.GetDirectoryName(targetPath) ?? string.Empty;
        }

        return string.Empty;
    }
}
