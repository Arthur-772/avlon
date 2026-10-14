using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Media;
using BigFolder.Models;
using BigFolder.Services;

namespace BigFolder.ViewModels;

public sealed class TileViewModel : INotifyPropertyChanged
{
    private ImageSource? _icon;
    private int _overflowCount;
    private ImageSource? _overflowIcon1;
    private ImageSource? _overflowIcon2;
    private ImageSource? _overflowIcon3;

    public TileViewModel(FolderItem? source)
    {
        Source = source;
    }

    public FolderItem? Source { get; }

    public ImageSource? Icon
    {
        get => _icon;
        set => SetField(ref _icon, value);
    }

    public bool HasSource => Source is not null;

    public bool IsOverflow { get; init; }

    public bool IsEmpty => Source is null && !IsOverflow;

    public string DisplayName
    {
        get
        {
            if (Source is not null)
            {
                return Source.DisplayName;
            }

            return IsOverflow ? "更多" : "添加";
        }
    }

    public int OverflowCount
    {
        get => _overflowCount;
        set
        {
            if (SetField(ref _overflowCount, value))
            {
                OnPropertyChanged(nameof(OverflowBadge));
            }
        }
    }

    public string OverflowBadge => OverflowCount > 99 ? "99+" : OverflowCount.ToString();

    public ImageSource? OverflowIcon1
    {
        get => _overflowIcon1;
        set => SetField(ref _overflowIcon1, value);
    }

    public ImageSource? OverflowIcon2
    {
        get => _overflowIcon2;
        set => SetField(ref _overflowIcon2, value);
    }

    public ImageSource? OverflowIcon3
    {
        get => _overflowIcon3;
        set => SetField(ref _overflowIcon3, value);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    private bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
        {
            return false;
        }

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName ?? string.Empty));
    }
}

public sealed class FolderViewModel
{
    private readonly IConfigStore? _configStore;
    private readonly IShellItemInspector? _itemInspector;
    private readonly IIconProvider? _iconProvider;
    private readonly IShellLauncher? _launcher;
    private readonly ObservableCollection<TileViewModel> _items = new();

    public FolderViewModel(
        IConfigStore? configStore,
        IShellItemInspector? itemInspector,
        IIconProvider? iconProvider,
        IShellLauncher? launcher)
    {
        _configStore = configStore;
        _itemInspector = itemInspector;
        _iconProvider = iconProvider;
        _launcher = launcher;
        GridTiles = new ObservableCollection<TileViewModel>();
        OverflowTile = new TileViewModel(null) { IsOverflow = true };
    }

    public ObservableCollection<TileViewModel> Items => _items;

    public ObservableCollection<TileViewModel> GridTiles { get; }

    public TileViewModel OverflowTile { get; }

    public event EventHandler? Changed;

    public void Load(AppConfig config)
    {
        _items.Clear();

        foreach (var item in config.Items)
        {
            _items.Add(CreateSourceTile(item));
        }

        RefreshTiles();
    }

    public void AddPaths(IEnumerable<string> paths)
    {
        if (_itemInspector is null)
        {
            return;
        }

        var added = false;

        foreach (var path in paths)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                continue;
            }

            var item = _itemInspector.CreateItem(path);

            if (item is null || ContainsItem(item))
            {
                continue;
            }

            _items.Add(CreateSourceTile(item));
            added = true;
        }

        if (added)
        {
            RefreshTiles();
            OnChanged();
        }
    }

    public void Remove(TileViewModel tile)
    {
        if (!tile.HasSource)
        {
            return;
        }

        var index = _items.IndexOf(tile);

        if (index >= 0)
        {
            _items.RemoveAt(index);
            RefreshTiles();
            OnChanged();
        }
    }

    public void MoveUp(TileViewModel tile)
    {
        MoveTile(tile, -1);
    }

    public void MoveDown(TileViewModel tile)
    {
        MoveTile(tile, 1);
    }

    public void Swap(TileViewModel draggedTile, TileViewModel targetTile)
    {
        if (!draggedTile.HasSource || !targetTile.HasSource || ReferenceEquals(draggedTile, targetTile))
        {
            return;
        }

        var from = _items.IndexOf(draggedTile);
        var to = _items.IndexOf(targetTile);

        if (from < 0 || to < 0)
        {
            return;
        }

        _items.Move(from, to);
        RefreshTiles();
        OnChanged();
    }

    public void Launch(TileViewModel tile)
    {
        if (tile.Source is { } item)
        {
            _launcher?.Launch(item);
        }
    }

    private void MoveTile(TileViewModel tile, int offset)
    {
        if (!tile.HasSource)
        {
            return;
        }

        var index = _items.IndexOf(tile);
        var target = index + offset;

        if (index < 0 || target < 0 || target >= _items.Count)
        {
            return;
        }

        _items.Move(index, target);
        RefreshTiles();
        OnChanged();
    }

    private TileViewModel CreateSourceTile(FolderItem item)
    {
        return new TileViewModel(item)
        {
            Icon = _iconProvider?.GetIcon(item),
        };
    }

    private bool ContainsItem(FolderItem item)
    {
        return _items.Any(existing =>
            string.Equals(existing.Source?.TargetPath, item.TargetPath, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(existing.Source?.Arguments, item.Arguments, StringComparison.Ordinal));
    }

    private void RefreshTiles()
    {
        GridTiles.Clear();

        for (var i = 0; i < GridMetrics.DirectSlots; i++)
        {
            if (i < _items.Count)
            {
                GridTiles.Add(_items[i]);
            }
            else
            {
                GridTiles.Add(new TileViewModel(null));
            }
        }

        var overflowCount = Math.Max(0, _items.Count - GridMetrics.DirectSlots);
        var overflowIcons = _items.Skip(GridMetrics.DirectSlots).Take(3).ToList();

        OverflowTile.OverflowCount = overflowCount;
        OverflowTile.OverflowIcon1 = overflowIcons.Count > 0 ? overflowIcons[0].Icon : null;
        OverflowTile.OverflowIcon2 = overflowIcons.Count > 1 ? overflowIcons[1].Icon : null;
        OverflowTile.OverflowIcon3 = overflowIcons.Count > 2 ? overflowIcons[2].Icon : null;
    }

    private void OnChanged()
    {
        Changed?.Invoke(this, EventArgs.Empty);
    }
}

public sealed class TileTemplateSelector : System.Windows.Controls.DataTemplateSelector
{
    public System.Windows.DataTemplate? NormalTemplate { get; set; }

    public System.Windows.DataTemplate? OverflowTemplate { get; set; }

    public override System.Windows.DataTemplate? SelectTemplate(object item, DependencyObject container)
    {
        return item is TileViewModel { IsOverflow: true } ? OverflowTemplate : NormalTemplate;
    }
}
