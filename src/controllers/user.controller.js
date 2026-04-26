import { APIError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;
  console.log("email:", email);

  if (
    [fullname, email, username, password].some(
      (field) => field.trim?.trim() === ""
    )
  ) {
    throw new APIError(400, "All fields are required");
  }

  const existedUser = User.findOne({
    $or: [{ username }, { email }, { password }],
  });

  if (existedUser) {
    throw new APIError(409, "User with email or username already exists");
  }
});

export { registerUser };
