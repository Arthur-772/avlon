using System;
using System.Linq;
using System.Threading.Tasks;
using Windows.Foundation;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;
using Windows.Storage.Streams;

internal static class OcrVideoFrames
{
    private static int Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("usage: OcrVideoFrames <frame.png> [more.png ...]");
            return 2;
        }

        try
        {
            foreach (var path in args)
            {
                var text = RunAsync(path).Result;
                Console.WriteLine("---- " + path + " ----");
                Console.WriteLine(text);
            }
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

    private static async Task<string> RunAsync(string path)
    {
        var file = await StorageFile.GetFileFromPathAsync(path).AsTask();
        using (var stream = await file.OpenAsync(FileAccessMode.Read).AsTask())
        {
            var decoder = await BitmapDecoder.CreateAsync(stream).AsTask();
            var bitmap = await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied).AsTask();

            var engine = OcrEngine.TryCreateFromLanguage(new Language("zh-Hans-CN"));
            if (engine == null)
            {
                engine = OcrEngine.TryCreateFromUserProfileLanguages();
            }
            if (engine == null)
            {
                throw new InvalidOperationException("No OCR engine available.");
            }

            var result = await engine.ExtractTextAsync(bitmap).AsTask();
            return result.Text ?? string.Empty;
        }
    }
}
