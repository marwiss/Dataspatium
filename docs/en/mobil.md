# Dataspatium Mobile and transfer between devices

Dataspatium Mobile is a small page for phones and tablets that receives, shows and forwards data from Dataspatium.
It runs from the web (<https://marwiss.github.io/Dataspatium/m/> or the same folder as the app on a web server of
your own) and can be installed as an app. The whole of Dataspatium does not run on the phone: the mobile page is a
courier, a receiver, a viewer and a forwarder.

The transfer goes directly between the devices over the local network with WebRTC, without a server and without
data passing through the internet. The computer shows a QR code, the phone scans it, and both show the same
verification code. The same technique connects two computers with pasted codes.

## The first time: pair the phone

1. On the computer: open *Share → Devices*, leave *Connect to* at *New device* and click *Show QR code*.
2. On the phone: open the camera and point it at the QR code. The mobile page opens in the browser (the first
   time it is fetched from the web; afterwards it sits in the phone's cache). The phone shows a 52-character code.
3. On the computer: type the phone's code into the field below the QR code and click *Connect*. A computer with a
   camera will be able to scan the phone's QR code instead in a coming version.
4. Both devices now show the same six-digit verification code. If it matches: click *Pair the device* on the
   computer. The phone is told and stores the pairing too.

Next time it is enough to choose the phone under *Connect to* on the computer, show the QR code and scan: the
connection is made without any code back. The pairing consists of the phone's certificate and a secret the
devices share; it is stored in the browser on both sides and can be removed under *Paired devices* (computer) or by
clearing site data (phone).

## Sending from the computer

Under *Send* you choose the selected datasets or all datasets as a bundle, or files from the computer. Datasets
first go through the review before sharing (see [dela.md](dela.md)): columns that look like identity numbers,
e-mail or phone numbers can be pseudonymised or dropped in the copy. The phone asks before receiving and shows the
verification code once more. The transfer goes in blocks with a checksum; if it breaks, it resumes from the blocks
that have already arrived when you connect again.

## On the phone

- **Received** lists bundles and files with the number of datasets, size and sender. A bundle opens with the list
  of its datasets; a dataset is shown as a table with a filter and paging, with the first column fixed when the
  table scrolls sideways.
- **Forward** sends the bundle or file through the phone's share sheet (e-mail, messages, cloud storage).
- **Send to a computer** queues the bundle: scan the other computer's QR code and it is sent there once the
  connection is up. That is the courier flow computer → phone → computer, also between two networks.
- The phone can also send its own files (*Send files from the phone*) to a connected computer; they are imported
  there as datasets, or opened under *Receive* if they are bundles.
- Apps on the phone can share files to Dataspatium Mobile through the share sheet when the mobile page is
  installed as an app; the files end up under *Received*.
- *Settings* holds the phone's name (what the computer shows), its code and the language.

A dataset is shown in its own form: pictures to look through, documents to read, places as points, a graph's nodes with their number of edges, what a model is made of and a plan's provisions. The rows are under *The rows*.

## Computer to computer

Choose *Another computer (paste a code)* on one computer and paste the code from the other computer's *Show QR
code* view (the *Copy* button below the QR code). The first computer then shows an answer code that is pasted on
the other under *Code from the device*. From there everything works as between computer and phone, pairing
included.

## Collecting in the field

A form from the computer lands at the top of the start page. The phone fills in rows without a network, with photo and position, and checks them at once against
the form and the dataset's rules. *Send to the computer* carries them back over the same connection. See [insamling.md](insamling.md).

## Requirements and limitations

- The devices must reach each other on the network. On home networks and most office networks it works;
  networks that isolate clients from each other (guest networks, some corporate networks) stop the connection.
  Then share the computer's or phone's own network (tethering) for a while.
- The computer needs Edge, Chrome or Firefox. The phone needs a browser with WebRTC and, for scanning, a camera;
  in Android Chrome QR codes are read directly in the page, in other browsers the code is opened through the camera
  app or pasted.
- The phone needs the web the first time to fetch the mobile page; afterwards it works without a network except
  for the transfer itself, which goes locally.
- No data is sent to any server. The QR code holds the computer's network address and a one-time key; the
  verification code protects against someone else on the network joining in. Pair only devices whose verification
  code you have compared.
- A transfer stays in memory; very large bundles (several hundred megabytes) can be too much for a phone.

## Troubleshooting

- *Waiting for the device to connect* never goes away: the devices are on different networks, or the network
  blocks traffic between them. Try tethering from the phone and connect the computer to it.
- *The other side is not the device the code points to*: the code that was typed belongs to another phone. Type it
  again.
- The verification codes differ: disconnect. Someone else may have scanned the code.
- The log at the bottom of the computer shows every step of the connection.
