using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;
using BigFolder.Models;
using BigFolder.Services;
using BigFolder.ViewModels;
using Microsoft.Win32;

namespace BigFolder;

public partial class MainWindow : Window
{
    private const double CollapsedWidth = GridMetrics.CellSize * 3 + 2;
    private const double CollapsedHeight = GridMetrics.CellSize * 3 + 2;
    private const double ExpandedWidth = 560;
    private const double ExpandedHeight = 520;

    private const int GwlExStyle = -20;
    private const int WsExNoActivate = 0x08000000;
    private const int WsExToolWindow = 0x00000080;
    private static readonly IntPtr HwndBottom = new(1);
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoActivate = 0x0010;

    private readonly FolderViewModel _viewModel;
    private readonly IConfigStore? _configStore;
    private readonly DispatcherTimer _saveTimer;
    private readonly AppConfig _config;
    private bool _suppressLocationEvents;
    private bool _locationDirty;
    private bool _isExpanded;
    private TileViewModel? _dragTile;

    public MainWindow(
        IConfigStore? configStore = null,
        IShellItemInspector? itemInspector = null,
        IIconProvider? iconProvider = null,
        IShellLauncher? launcher = null)
    {
        InitializeComponent();

        _configStore = configStore;
        _config = configStore?.Load() ?? new AppConfig();
        _viewModel = new FolderViewModel(configStore, itemInspector, iconProvider, launcher);
        _viewModel.Changed += ViewModel_Changed;
        DataContext = _viewModel;

        _saveTimer = new DispatcherTimer(DispatcherPriority.Background)
        {
            Interval = TimeSpan.FromMilliseconds(350),
        };
        _saveTimer.Tick += SaveTimer_Tick;

        Width = CollapsedWidth;
        Height = CollapsedHeight;
        PositionWindow();
        _viewModel.Load(_config);

        SourceInitialized += MainWindow_SourceInitialized;
        LocationChanged += MainWindow_LocationChanged;
        Closed += MainWindow_Closed;
        Drop += MainWindow_Drop;
    }

    public bool IsExpanded => _isExpanded;

    private void MainWindow_SourceInitialized(object? sender, EventArgs e)
    {
        var handle = new WindowInteropHelper(this).Handle;
        var style = GetWindowLong(handle, GwlExStyle);
        SetWindowLong(handle, GwlExStyle, style | WsExNoActivate | WsExToolWindow);
        SetWindowPos(handle, HwndBottom, 0, 0, 0, 0, SwpNoSize | SwpNoMove | SwpNoActivate);
    }

    private void PositionWindow()
    {
        _suppressLocationEvents = true;
        Left = Math.Clamp(_config.WindowLeft, 0, Math.Max(0, SystemParameters.WorkArea.Width - Width));
        Top = Math.Clamp(_config.WindowTop, 0, Math.Max(0, SystemParameters.WorkArea.Height - Height));
        _suppressLocationEvents = false;
    }

    private void MainWindow_LocationChanged(object? sender, EventArgs e)
    {
        if (_suppressLocationEvents)
        {
            return;
        }

        _locationDirty = true;
        _saveTimer.Stop();
        _saveTimer.Start();
    }

    private void SaveTimer_Tick(object? sender, EventArgs e)
    {
        if (!_locationDirty)
        {
            return;
        }

        _locationDirty = false;
        SaveConfiguration();
    }

    private void ViewModel_Changed(object? sender, EventArgs e)
    {
        SaveConfiguration();
    }

    private void MainWindow_Closed(object? sender, EventArgs e)
    {
        _saveTimer.Stop();
        SaveConfiguration();
    }

    private void SaveConfiguration()
    {
        if (_configStore is null)
        {
            return;
        }

        _config.WindowLeft = Left;
        _config.WindowTop = Top;
        _config.WindowWidth = CollapsedWidth;
        _config.WindowHeight = CollapsedHeight;
        _config.Items = _viewModel.Items
            .Where(tile => tile.Source is not null)
            .Select(tile => tile.Source!)
            .ToList();
        _configStore.Save(_config);
    }

    private void RootBorder_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (!IsBackgroundClick(e.OriginalSource, RootBorder))
        {
            return;
        }

        try
        {
            DragMove();
        }
        catch (InvalidOperationException)
        {
        }
    }

    private static bool IsBackgroundClick(object originalSource, Border rootBorder)
    {
        if (ReferenceEquals(originalSource, rootBorder))
        {
            return true;
        }

        return originalSource is TextBlock { Text: "BigFolder" } or Grid { Name: "CollapsedView" } or Grid { Name: "ExpandedView" };
    }

    private void Tile_MouseLeftButtonUp(object sender,MouseButtonEventArgs e)
    {
        e.Handled = true;

        if (sender is not FrameworkElement element || element.DataContext is not TileViewModel tile)
        {
            return;
        }

        if (tile.IsOverflow)
        {
            ToggleExpanded();
            return;
        }

        if (tile.HasSource)
        {
            _viewModel.Launch(tile);
            return;
        }

        PickFiles();
    }

    private void PickFiles()
    {
        var dialog = new OpenFileDialog
        {
            Title = "添加程序或文件",
            Multiselect = true,
            Filter = "所有文件 (*.*)|*.*",
        };

        if (dialog.ShowDialog(this) == true)
        {
            _viewModel.AddPaths(dialog.FileNames);
        }
    }

    private void Collapse_Click(object sender, RoutedEventArgs e)
    {
        Collapse();
    }

    private void Exit_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void ToggleExpanded()
    {
        if (_isExpanded)
        {
            Collapse();
        }
        else
        {
            Expand();
        }
    }

    private void Expand()
    {
        _isExpanded = true;
        CollapsedView.Visibility = Visibility.Collapsed;
        ExpandedView.Visibility = Visibility.Visible;
        Width = ExpandedWidth;
        Height = ExpandedHeight;
    }

    private void Collapse()
    {
        _isExpanded = false;
        ExpandedView.Visibility = Visibility.Collapsed;
        CollapsedView.Visibility = Visibility.Visible;
        Width = CollapsedWidth;
        Height = CollapsedHeight;
    }

    private void MainWindow_Drop(object sender, DragEventArgs e)
    {
        if (!e.Data.GetDataPresent(DataFormats.FileDrop, true))
        {
            return;
        }

        if (e.Data.GetData(DataFormats.FileDrop, true) is string[] paths && paths.Length > 0)
        {
            _viewModel.AddPaths(paths);
            e.Handled = true;
        }
    }

    private void ExpandedTile_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (sender is FrameworkElement { DataContext: TileViewModel tile } && tile.HasSource)
        {
            _dragTile = tile;
        }
    }

    private void ExpandedTile_MouseMove(object sender, MouseEventArgs e)
    {
        if (_dragTile is null || e.LeftButton != MouseButtonState.Pressed)
        {
            return;
        }

        var position = e.GetPosition(sender as IInputElement);

        if (Math.Abs(position.X) < SystemParameters.MinimumHorizontalDragDistance &&
            Math.Abs(position.Y) < SystemParameters.MinimumVerticalDragDistance)
        {
            return;
        }

        var data = new DataObject();
        data.SetData(typeof(TileViewModel), _dragTile);
        _dragTile = null;
        DragDrop.DoDragDrop((DependencyObject)sender, data, DragDropEffects.Move);
    }

    private void ExpandedTile_DragOver(object sender, DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(typeof(TileViewModel)) ? DragDropEffects.Move : DragDropEffects.None;
        e.Handled = true;
    }

    private void ExpandedTile_Drop(object sender, DragEventArgs e)
    {
        if (e.Data.GetData(typeof(TileViewModel)) is TileViewModel draggedTile &&
            sender is FrameworkElement { DataContext: TileViewModel targetTile })
        {
            _viewModel.Swap(draggedTile, targetTile);
        }

        e.Handled = true;
    }

    private void MoveUp_Click(object sender, RoutedEventArgs e)
    {
        if (GetContextTile(sender) is { } tile)
        {
            _viewModel.MoveUp(tile);
        }
    }

    private void MoveDown_Click(object sender, RoutedEventArgs e)
    {
        if (GetContextTile(sender) is { } tile)
        {
            _viewModel.MoveDown(tile);
        }
    }

    private void RemoveItem_Click(object sender, RoutedEventArgs e)
    {
        if (GetContextTile(sender) is { } tile)
        {
            _viewModel.Remove(tile);
        }
    }

    private static TileViewModel? GetContextTile(object sender)
    {
        return sender as TileViewModel ?? (sender as FrameworkElement)?.DataContext as TileViewModel;
    }

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
}
