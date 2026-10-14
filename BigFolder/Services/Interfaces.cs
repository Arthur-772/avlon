using System.Windows.Media;
using BigFolder.Models;

namespace BigFolder.Services;

public interface IConfigStore
{
    AppConfig Load();

    void Save(AppConfig config);
}

public interface IShellLauncher
{
    void Launch(FolderItem item);
}

public interface IShellItemInspector
{
    FolderItem? CreateItem(string path);
}

public interface IIconProvider
{
    ImageSource? GetIcon(FolderItem item);
}

public sealed record ShellLinkInfo(
    string TargetPath,
    string Arguments,
    string WorkingDirectory,
    string IconPath,
    int IconIndex);
