import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

cloudinary.v2.uploader
  .upload("dog.mp4", {
    resource_type: "video",
    public_id: "my_dog", 
    overwrite: true,
    notification_url: "https://mysite.example.com/notify_endpoint",
  })
  .then((result) => console.log(result));

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("File is uploaded on Cloudinary!", response.url);
    return response;
  } catch (error) {
    fs.unlikeSync(localFilePath);
    return null;
  }
};
