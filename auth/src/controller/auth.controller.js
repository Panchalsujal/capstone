import userModel from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import { sendAuthNotification } from "../config/mq.js";
export const googleAuthController = async (req, res) => {
  try {
    const { id, displayName, emails, photos } = req.user;
    let user = await userModel.findOne({ googleId: id });

    if (!user) {
      user = new userModel({
        googleId: id,
        email: emails[0].value,
        name: displayName,
        avatar: photos[0].value,
      });
      await user.save();
    }

    await sendAuthNotification({
      userId: user._Id,
      action: "google_login",
      timestamp: new Date(),
      email: emails[0].value,
    });

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, config.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Set token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    
    res.redirect("http://localhost:5173");
  } catch (err) {
    console.error("Error during Google authentication:", err);
    res.redirect("/");
  }
};
