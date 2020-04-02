## Yet another superfluous stream detector

Filters requests for well-known stream/playlist files (e.g. .m3u8) and copies them to the clipboard or a file.
The request details are embedded into a user-defined string, i.e. you can write the console command for FFmpeg or youtube-dl with placeholders for the URL, cookies etc..

### Usage
**Create a profile in the add-on settings!**

Most of the fields are self-explanatory, nevertheless here some notes:

* *Filter Stream URL* is a regex. Only streams where the URL matches are added to the list (be aware that the streams are usually fetched from a CDN when trying to filter for specific domains).

* *Command* has a special character **$** that needs to be escaped by using it twice (i.e. **$$** is translated to **$** in the output). The following placeholders are available:
  * `${stream}`: The stream URL.
  * `${filename}`: Filename of the stream/playlist file extracted from the URL w/o extension.
  * `${timestamp}`: Epoch time of the moment the stream was added to the list.
  * `${tabtitle}`: Title of the tab that initiated the request (at the time the request is processed by the addon).
  * `${useragent}`: The user-agent string sent in the request (or of the browser if it's missing).
  * `${referer}`: The referer (or empty string if missing).
  * `${cookie:|START|JOIN|END|}`: For the tree cookies C1, C2, C3 the placeholder expands to `STARTC1JOINC2JOINC3END`.


## Cui honorem, honorem
The add-on was created after inspecting the source code of [The Stream Detector](https://addons.mozilla.org/en-US/firefox/addon/hls-stream-detector/) by [rowrawer](https://github.com/rowrawer). This is not a fork of said project, but it was a source of inspiration.
