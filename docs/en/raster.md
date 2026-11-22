# Rasters

A raster is a georeferenced image in pixels: an orthophoto, a drone's picture, a scanned map or an elevation model in GeoTIFF. One
or more GeoTIFF files (tiles) become one dataset of the kind *raster* with one row per file: width and height, bands, data type,
resolution, coordinate system, year, source, licence, file size and the file's extent as a polygon in WGS 84 (`geometri`). The
images live in the dataset's own file: the original when it is small enough, a preview in Web Mercator for the maps and a
thumbnail. The files are read in a thread of their own (a worker) when you choose them, and nothing is fetched from the net. The
table is always one button away.

## Importing GeoTIFF

- Drop one or more files (`.tif`, `.tiff`, `.gtiff`) in Import. The format is called *Raster (GeoTIFF, cloud-optimised GeoTIFF)*.
  Plain GeoTIFF files, cloud-optimised ones (COG) and BigTIFF are read, with tiles or strips, uncompressed or with LZW, Deflate,
  PackBits, LERC, JPEG or WebP.
- Import shows what the file is, its coordinate system, resolution, pixels, bands and data type and whether the original is kept,
  and a picture of the file at a small size when it can be read quickly (a small file, or one with overviews). There is no column
  step: give the name and press *Import*.
- Several files become one raster with one row per file, at most 16 files; the others are left out and named. A file that cannot
  be read is left out with its reason, and the rest are imported. Import names those files before the import and after it, and so
  does the log. Two files with the same name (the same tile from two folders) are kept apart: the second gets *(2)* after its name.
- The preview is converted pixel by pixel to Web Mercator, so that it lies right on the maps. Its longest side is at most 2,048
  pixels (1,024 when the raster has more than four files) and never finer than the file. The thumbnail is at most 320 pixels.
- The original file is kept byte for byte when it is at most 32 MB and the raster's original files together at most 40 MB. A larger
  file gets only the preview and the thumbnail, and the raster's facts say so.
- A large file is read from the overview level that fits the preview. The level read may have at most 300 million pixels, so a
  large file without overviews is not read.
- The coordinate system is read from the file's GeoKeys, as an EPSG code or as a name. The app converts the systems listed in
  [kartor.md](kartor.md#coordinate-systems). When the file names no system, it is taken as degrees when its extent fits in degrees,
  otherwise as SWEREF 99 TM, as for other files. A system the app cannot convert is said before the import: the file is kept with
  its picture but without a place, and it is not shown on the map.
- Colour images are shown as they are, also with 16 bits per band, with a palette or in CMYK. One band of 8 bits is shown in grey,
  and three or more bands of 8 bits without a colour interpretation as the first three. Otherwise, for example for an elevation model
  with decimal numbers, the first band is shown in grey from 2 to 98 per cent of its values, and the file's empty value
  (GDAL_NODATA) becomes transparent. An extra band is transparency only when the file says so, so the infrared of Lantmäteriet's
  four-band files does not become transparency.
- The year comes from the file's date, and the source and the attribution from its Copyright tag, whose text goes with the image.
  The values of tags that can name a person (Artist, HostComputer, ImageDescription, DocumentName, XMP, Exif, IPTC, Photoshop and
  GDAL_METADATA) are never read out. The app notes only which of them are present, for the review before sharing.

When a file cannot be read, the app says why and what you can do:

| The file | What you can do |
|---|---|
| Is not a TIFF file | Check the file; it may be another kind of image with the wrong file extension |
| Has no place | Save it as PNG or JPEG for an image collection, or georeference it in a GIS program and save it as GeoTIFF |
| Is rotated in its grid | Write it again without rotation, for example with `gdalwarp`, and import it again |
| Is compressed in a way the app cannot read (for example old JPEG or ZSTD) | Save it with LZW, Deflate or JPEG |
| Is too large to read without overviews | Make it a cloud-optimised GeoTIFF (`gdal_translate -of COG`) or add overviews (`gdaladdo`) |

## The raster on the map

- In Process the raster opens as a map: each file's preview at its place, with the files' outlines on top and the file name as
  label. The inspector shows the raster's facts, *Opacity (0–1)*, which applies at once, and how many files have no place. *Show as
  table* gives the table of files.
- The table is the list of files. When you remove a row, the file's image leaves the maps, the export and the copies that are
  shared, and the files are counted by the rows.
- The images lie above the background map and the services' layers and under the features. The attribution stands in the corner of
  the map as text, with the licence linked.
- The images come from the dataset's own file. The map asks for no consent and fetches nothing, except the background map if you
  choose one.
- Manage shows the first file at a small size, the raster's facts, files without a place and files without an original, and the
  button *Show on the map*.
- In Search the files are found by free text and by place, and a hit opens the file on the map with *Show the file on the map*.
- Check tests the table of files as a table. Analyse opens in SQL with the query *The files by resolution*, which also exists for R
  and Python.

## Save the orthophoto

- When Lantmäteriet's orthophoto is the background map, *Save the orthophoto* stands beside *Fetch orthophoto for the view*: in
  Process, in the map views in Visualise and under the place of a new building.
- The button saves the image the map shows as a dataset of the kind raster, with the image as its preview and a thumbnail. The name
  proposed is *Orthophoto* with the year. It is the image in Web Mercator that the app has already read for the view (at most 1 km²,
  longest side at most 2,048 pixels), not Lantmäteriet's files, so there is no original file.
- The attribution follows Lantmäteriet's terms: "Ortofoto © Lantmäteriet (year), processed for the map", with the licence CC BY 4.0.
  It stands in the raster's facts, in the corner of the map, on the phone and in `kreditering.txt` at export.
- Nothing is fetched again, and the dataset carries neither the key, the token, the login nor the files' addresses. The source names
  Lantmäteriet, the images' ids and collections, the area and the time.
- A saved orthophoto is then shown without the net and without a key, under the place of a new building or as a layer in a map view.
- Only Lantmäteriet's image in Web Mercator is saved. The button is not on the plan map, where the image can lie in the files' own
  grid. Denmark's, Finland's and Iceland's orthophotos come as tiles from their services and are not saved, and Norway has no open
  orthophoto.

## Under the place of a new building

In the mode *Build from brief*, *The place on the map* shows the footprint (see
[cad-bim.md](cad-bim.md#a-new-building-from-a-brief)). The choice of background lists the rasters in the workspace that cover the
place, under *Rasters in the workspace*. When you choose one, it is drawn under the footprint straight from the dataset, without the
net, a key or a consent question, and the line under the map names the raster with its attribution. When you have read
Lantmäteriet's orthophoto for the place, *Save the orthophoto* stands beside the choice, so that the place can be shown without the
net next time.

## Map views in Visualise

- A raster is added as a layer under *Add layer*, in the list of datasets, and goes under the layers already there. The layer's card
  has *Opacity (0–1)*, which applies at once, and visibility, and the order is changed as for other layers.
- The suggestion for a raster in Visualise is its own map: the images and the files' outlines.
- A saved map view finds its raster by name, also in another workspace, as a table's layer does.
- The raster is drawn in Web Mercator. In a map view in a coordinate system of its own (a plan in its own system) it is not drawn.

## Export and share

- Export has *GeoTIFF: the original file* (one file as it came, several in a ZIP) when the originals were kept, and *GeoTIFF in Web
  Mercator: the image on the map (ZIP)*: each file's preview as a GeoTIFF in Web Mercator (EPSG:3857, 8 bits per band with
  transparency), with `kreditering.txt` beside it (the attribution, the licence with its address and the source). The table formats
  give the table of files, without the images.
- The review before sharing (see [dela.md](dela.md#review-before-sharing)) covers the raster's original files. When a file has tags
  that can name a person, the tags' names stand by the file, and removing the originals in the copy is then the default. The copy
  keeps the previews and the thumbnails, and its facts say that the originals were left out when the dataset was shared.
- The attribution is the same text as the column *kalla*. It is masked when the column is masked and removed when the column is
  pseudonymised or dropped, and when only the attribution holds personal data it gets a choice of its own.
- Bundles, GitHub and devices carry the dataset with its images. The limits on the originals keep a raster under GitHub's limit of
  100 MB per file.
- Dataspatium Mobile shows the thumbnails with the attribution and the licence.

## Tiers

The raster's map and map layers belong to tier 2, **BIM + GIS**. In **Documents** GeoTIFF files are still read, as IFC files are,
and the raster is its table of files. Manage keeps the picture and the facts but not *Show on the map*, Process opens the table and
says which tier the map belongs to, Analyse opens in Statistics, a hit in Search opens the row, Check tests the table, Export has the
original file and the table formats but not the image on the map, and Share carries the dataset as it is. *Save the orthophoto* is in
the map views, which belong to BIM + GIS. A higher tier shows everything again at once (see
[anvandarguide.md](anvandarguide.md#tiers)).

## Limitations

- A rotated file is not read. A world file (`.tfw`) beside the file is not read either, so a TIFF that has only a world file has no
  place.
- GDAL's masks, in the file or in a `.msk` file, are not used.
- 16 bits per band are shown by their eight highest bits, so a dark image stays dark. A single band is shown in grey from 2 to 98 per
  cent, without a colour ramp or shading.
- The app does not compute with the values of an elevation model or another band of measurements (slope, volumes, profiles); they
  are shown as an image.
- The raster is left out of exported map images (SVG, PNG, PDF), document templates and published HTML.
- Search counts a file by the middle of its extent, not by overlap.
- The raster is not shown on the plan map or in a map in a coordinate system of its own.
- The maps end at 85 degrees north and south, where Web Mercator ends, so a file that reaches the poles is shown without them.
- A version of the raster is a whole copy of the file with its images, as for models.
- Drone pictures can show people, number plates and homes. The review before sharing does not see that, so you judge it yourself.
- Spreading aerial and drone pictures can need a permit, in Sweden under the Act on the protection of geographical information. That
  is your own responsibility.
