# 📁 Cloud Document Storage App

A simple React application to securely upload and view documents using:

- 🧑‍💻 Supabase for authentication & database
- ☁️ Cloudinary for file storage

Users are anonymously authenticated and can upload files which are stored on Cloudinary. The document metadata (name, URL, owner) is saved in Supabase and displayed in the app.

## 🚀 Features

- Anonymous user login via Supabase
- File uploads directly to Cloudinary
- Store and retrieve documents in real-time
- User-specific document listing

## 🔧 Technologies Used

- React (Create React App)
- Supabase (Auth & PostgreSQL DB)
- Cloudinary (File Storage)

## ▶️ Getting Started

To run this project locally:

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/doc-storage-client.git
   cd doc-storage-client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Add your environment variables:

   Create a .env file (or directly modify the supabaseKey, supabaseUrl, etc. in App.js).

4. Start the app:

   ```bash
   npm start
   ```

   The app will open at http://localhost:3000

## ✍️ Setup Notes

- Ensure your Supabase project has a table named documents with these columns:
  - id (primary key)
  - file_name (text)
  - url (text)
  - owner_id (uuid)

- Enable anonymous sign-in in Supabase Auth settings.

- Set up your Cloudinary upload preset (unsigned) for public uploads.

## 📸 Screenshot

![App Screenshot](screenshot.png)

## 📜 License

This project is open source and available under the MIT License.

---

## Deployment Notes

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
