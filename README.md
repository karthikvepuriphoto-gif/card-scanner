# Card Scanner

Scan a business card on your phone and add the person to your contacts. The photo, the text, and the saved list stay on the device. There is no account and no server.

Live app: <https://karthikvepuriphoto-gif.github.io/card-scanner/>

## Use it

1. Open the link in Safari on iPhone, or in Chrome on Android.
2. Point the camera at a card and tap the shutter, or choose a photo. **Try sample** loads a demo card if you want to see the flow first.
3. Fix anything in the review form. The card photo stays with the record.
4. Tap **Add to Contacts**. The phone opens its own contact sheet (on iPhone, Create New Contact / Add to Contacts). A website cannot write into the iOS address book by itself, so this hands the phone a vCard 3.0 file, including a small copy of the card photo.
5. Tap **Scan next card** to keep going.
6. **Saved** keeps every card on this phone. Search, open one to edit it, add it to contacts again, delete it, or export the whole list as one `.vcf` or as CSV.

The first visit downloads the text-recognition files (about 15 MB). After that the app works offline, including from the home screen.

## Add it to the iPhone home screen

1. Open the site in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**. If you do not see it, scroll the share sheet and choose **Edit Actions**, then add it.
4. Leave **Open as Web App** turned on.
5. Tap **Add**.

Open **Cards** from the home screen after that. Saving a contact from the installed app opens Safari with the contact sheet, because the home-screen window itself will not show Add to Contacts.

## Develop

```bash
npm install
npm test
npm run dev
```

The dev server uses the `/card-scanner/` base path. `npm test` checks the field parser, the vCard file, and optical character recognition of `public/samples/jordan-lee.png`.

GitHub Actions publishes the `main` branch to GitHub Pages.
