export async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "docs_unsigned"); // use your actual preset name

  const response = await fetch(
    "https://api.cloudinary.com/v1_1/dbj9qw0co/auto/upload", // use your actual cloud name
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();
  return data.secure_url;
}
