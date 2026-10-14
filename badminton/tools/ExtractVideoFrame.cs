using System;
using System.IO;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Media.Editing;
using Windows.Storage;
using Windows.Storage.Streams;

internal static class ExtractVideoFrame
{
    private static int Main(string[] args)
    {
        if (args.Length != 3)
        {
            Console.Error.WriteLine("usage: ExtractVideoFrame <input.mp4> <time-seconds> <output.png>");
            return 2;
        }

        try
        {
            RunAsync(args[0], double.Parse(args[1]), args[2]).Wait();
            return 0;
        }
        catch (AggregateException ex)
        {
            foreach (var inner in ex.InnerExceptions)
            {
                Console.Error.WriteLine(inner.ToString());
            }
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            return 1;
        }
    }

    private static async Task RunAsync(string input, double seconds, string output)
    {
        var file = await StorageFile.GetFileFromPathAsync(input).AsTask();
        var clip = await MediaClip.CreateFromFileAsync(file).AsTask();
        var composition = new MediaComposition();
        composition.Clips.Add(clip);

        var frame = await composition.GetThumbnailAsync(
            TimeSpan.FromSeconds(seconds),
            576,
            1280,
            VideoFramePrecision.NearestFrame).AsTask();

        if (frame?.SoftwareBitmap == null)
        {
            throw new InvalidOperationException("Media Foundation returned no SoftwareBitmap.");
        }

        var outputFile = await StorageFile.CreateFileAsync(
            output,
            CreationCollisionOption.ReplaceExisting).AsTask();

        using (var stream = await outputFile.OpenAsync(FileAccessMode.ReadWrite).AsTask())
        {
            var encoder = await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId, stream).AsTask();
            encoder.SetSoftwareBitmap(frame.SoftwareBitmap);
            await encoder.FlushAsync().AsTask();
        }
    }
}
