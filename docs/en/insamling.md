# Field collection

With **Field collection** you fill in rows on the phone, with or without a network, with photo and position. The form is built on a
dataset's columns and rules, so a wrong row shows at once where you stand. The rows then come back to the computer as a new version
of the dataset. The photos become an image collection and the positions end up on the map.

## How it works

1. In **Import**, choose *Field collection*, and there a dataset or *New dataset*.
2. Decide which fields the phone should ask for, and press *Send to the phone*.
3. Connect the phone under **Devices** in Share, and send the form. The phone needs a network this time.
4. On the phone, open the form and collect rows. No network is needed now.
5. When you are back, press *Send to the computer* and scan the computer's code.
6. The computer shows what has arrived, and you choose *Add*.

## The form

Each column becomes a field. You can switch a column off, change the label and choose whether the field is required. *Keep for the next
row* suits what is the same on many rows, such as a date or an area.

The field's type comes from the column. Value labels and the rule *allowed values* become a list of choices by themselves. You can also
write choices yourself, one per line as `value` or `code = text`, or fetch them with *Fetch choices from the column*.

Position and photos can be off, optional or required. Photos are reduced on the phone so that the long side becomes 2048 pixels, unless
you choose something else under *More options*.

*New dataset* takes one column per line, such as `place` or `count: integer`.

Before the form leaves the computer the app shows what goes along. That is fields, labels, choices and rules, never rows.

## The rules

The phone checks the rules with the same SQLite as the computer, so a row is judged alike in both places.

- **Checked on the phone:** ranges, allowed and forbidden values, patterns, formats, length, identity numbers, comparisons between
  columns and free SQL conditions that only use the form's columns.
- **Unique values** are compared only with the rows on the phone. The computer checks against the whole dataset.
- **Checked only on the computer:** completeness, values in another dataset and rules about columns that are not in the form.

An error in the form, such as an empty required field or a letter in a number field, stops the row from being saved. A broken rule stops
it once. If you press Save again the row is kept with the rule noted, since you who stand on the spot may know better than the rule.

## On the phone

The form is at the top of the start page in Dataspatium Mobil. *Save and new row* is the usual way on.

A row you are working on is saved as a draft from the first change, and photos are stored as soon as they are taken. Phones sometimes close
the page when the camera opens. The form then offers *Continue the draft* when you come back.

The phone shows *Works without a network on this phone* when it has all it needs. If it says instead that the page should be opened once
more, do that while you have a network. Install the page on the home screen if you can. Browsers may otherwise clear the storage of pages
that are not used, and on an iPhone that can happen after a week without use.

Rows stay on the phone until you choose *Clear sent*. A sent row cannot be changed on the phone, only on the computer.

If you have no connection to the computer you can use *Share as a file* and send the file another way. It is received under **Receive** in Share.

## On the computer

The rows arrive through Devices or Receive, and you see them before anything is added.

- The table is first saved as a version, so you can go back.
- Missing columns are added: `falt_id`, `lat`, `lon`, `noggrannhet_m`, `foto`, `insamlad` and `insamlad_av`. If the dataset already has
  columns for longitude and latitude, those are used.
- The dataset opens as a map in Process, since the rows have positions.
- The photos become the image collection *Name: photos*, with the row's position and time. Later deliveries join the same collection.
- The dataset's rules are run on the result, and the log says how many are broken.

Rows are recognised by `falt_id`. The same file can therefore be received twice without anything being doubled, but a row changed on the
computer is not overwritten.

If the dataset is no longer on the computer, a new one with the form's columns is suggested.

## Personal data

Position and photos are often personal data, and a photo can show people. Ask only for what is needed, and otherwise switch position and photos off.

The phone asks for permission before it gives out the position, and the position itself goes nowhere until you send the rows. Rows and photos
lie unencrypted in the browser's storage on the phone, so send them and clear them regularly.

## Limits

- Dataspatium Mobil runs from a web address, not from a file, and needs a network the first time.
- The accuracy of a position depends on the phone. The field `noggrannhet_m` says how sure it is.
- Large collections are divided into several files, which are received one at a time.
- Several phones can collect with the same form. Each phone has its own rows, and they are added separately.
