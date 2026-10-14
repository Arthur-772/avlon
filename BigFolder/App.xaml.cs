using System.Reflection;
using System.Windows;
using BigFolder.Services;

namespace BigFolder;

public partial class App : Application
{
    private void OnStartup(object sender, StartupEventArgs e)
    {
        var configStore = new JsonConfigStore();
        var itemInspector = ResolveService<IShellItemInspector>();
        var iconProvider = ResolveService<IIconProvider>();
        var launcher = ResolveService<IShellLauncher>();

        new MainWindow(configStore, itemInspector, iconProvider, launcher).Show();
    }

    private static T? ResolveService<T>()
        where T : class
    {
        return typeof(App).Assembly
            .GetExportedTypes()
            .Where(type => type.IsClass && !type.IsAbstract && typeof(T).IsAssignableFrom(type))
            .Select(type => type.GetConstructor(Type.EmptyTypes))
            .FirstOrDefault(constructor => constructor is not null)?
            .Invoke(Array.Empty<object>()) as T;
    }
}
