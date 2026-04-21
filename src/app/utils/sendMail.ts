import nodemailer from 'nodemailer';
import config from '../../config';

// export const sendEmail = async (to: string, html: string, subject: string) => {
//   console.log(to);
//   try {
//     const transporter = nodemailer.createTransport({
//       host: 'smtp.gmail.com',
//       port: 587,
//       secure: false,
//       auth: {
//         // TODO: replace `user` and `pass` values from <https://forwardemail.net>
//         user: config.mail,
//         pass: config.mail_password,
//       },
//     });

//     const result = await transporter.sendMail({
//       from: 'akonhasan680@gmail.com', // sender address
//       to, // list of receivers
//       subject, // Subject line
//       text: '', // plain text body
//       html, // html body
//     });
//     console.log(result);
//   } catch (error) {}
// };

export const sendEmail = async (to: string, html: string, subject: string) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: config.mail,
        pass: config.mail_password,
      },
    });
    const result = await transporter.sendMail({
      from: 'muhammadjunayetmaruf@gmail.com',
      to,
      subject,
      text: '', 
      html,
    });
    console.log(result);
  } catch (error) { }
};


export const sendOtpViaMail = async (to: string, OTP: string) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP Verification</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; line-height: 1.6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #FF7600; background-image: linear-gradient(135deg, #FF7600, #45a049); padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">OTP Verification</h1>
        </div>
        <div style="padding: 20px 12px; text-align: center;">
            <p style="font-size: 18px; color: #333333; margin-bottom: 10px;">Hello,</p>
            <p style="font-size: 18px; color: #333333; margin-bottom: 20px;">Your OTP for verifying your account is:</p>
            <p style="font-size: 36px; font-weight: bold; color: #FF7600; margin: 20px 0; padding: 10px 20px; background-color: #f0f8f0; border-radius: 8px; display: inline-block; letter-spacing: 5px;">${OTP}</p>
            <p style="font-size: 16px; color: #555555; margin-bottom: 20px; max-width: 400px; margin-left: auto; margin-right: auto;">Please enter this OTP to complete the verification process. This OTP is valid for 5 minutes.</p>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="font-size: 14px; color: #888888; margin-bottom: 4px;">Thank you for choosing our service!</p>
                <p style="font-size: 14px; color: #888888; margin-bottom: 0;">If you didn't request this OTP, please ignore this email.</p>
            </div>
        </div>
        <div style="background-color: #f9f9f9; padding: 10px; text-align: center; font-size: 12px; color: #999999;">
            <p style="margin: 0;">© 2023 Quirpleb. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  await sendEmail(to, html, 'Quirpleb: Verification OTP')

}


export const sendLinkViaMail = async (to: string, link: string) => {
  const html = `<!DOCTYPE html> 
<html lang="en"> 
<head> 
  <meta charset="UTF-8" /> 
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/> 
  <title>Verification Link - Overlanding Outpost</title> 
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head> 
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8faf8 0%, #e8f4f0 100%); margin: 0; padding: 40px 20px; line-height: 1.6;"> 
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(75, 55, 32, 0.08), 0 2px 8px rgba(75, 55, 32, 0.04); border: 1px solid rgba(75, 55, 32, 0.06);"> 
    <!-- Header Section -->
    <div style="background: linear-gradient(135deg, #4B3720 0%, #5d4429 100%); padding: 50px 30px 40px; text-align: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(203, 250, 241, 0.1) 0%, transparent 70%); pointer-events: none;"></div>
      <div style="position: relative; z-index: 2;">
        <div style="display: inline-block; padding: 12px 24px; background-color: rgba(203, 250, 241, 0.15); border: 1px solid rgba(203, 250, 241, 0.3); border-radius: 50px; margin-bottom: 20px;">
          <span style="color: #CBFAF1; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">OVERLANDING OUTPOST</span>
        </div>
        <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.02em;">Verify Your Account</h1>
        <p style="color: #CBFAF1; margin: 16px 0 0 0; font-size: 16px; opacity: 0.9;">Complete your registration to start your adventure</p>
      </div>
    </div> 
    <!-- Content Section -->
    <div style="padding: 50px 40px; text-align: center;"> 
      <div style="margin-bottom: 40px;">
        <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #CBFAF1 0%, #a8f0e1 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(203, 250, 241, 0.3);">
          <span style="font-size: 32px;"></span>
        </div>
        <h2 style="font-size: 24px; color: #4B3720; margin: 0 0 16px 0; font-weight: 600; letter-spacing: -0.01em;">Almost There!</h2>
        <p style="font-size: 16px; color: #6b7280; margin: 0; line-height: 1.6; max-width: 400px; margin: 0 auto;"> 
          We've sent you this email to verify your account. Click the button below to complete your registration and join the Overlanding Outpost community.
        </p>
      </div>
      <!-- CTA Button -->
      <div style="margin: 40px 0;">
        <a href="${link}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #4B3720 0%, #5d4429 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 16px rgba(75, 55, 32, 0.25), 0 2px 4px rgba(75, 55, 32, 0.1); transition: all 0.2s ease; letter-spacing: 0.02em; border: 1px solid rgba(203, 250, 241, 0.1);"> 
          VERIFY MY ACCOUNT
        </a>
      </div>
      <!-- Alternative Link Section -->
      <div style="margin-top: 40px; padding: 24px; background-color: #f9fafb; border-radius: 12px; border-left: 4px solid #CBFAF1;">
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #4B3720; font-weight: 500;">Trouble clicking the button?</p> 
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Copy and paste this link into your browser:</p>
        <div style="background-color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 8px;">
          <a href="${link}" style="color: #4B3720; text-decoration: none; font-size: 13px; word-break: break-all; font-family: 'Courier New', monospace;">${link}</a> 
        </div>
      </div>
      <!-- Security Notice -->
      <div style="margin-top: 32px; padding: 20px; background: linear-gradient(135deg, rgba(203, 250, 241, 0.1) 0%, rgba(203, 250, 241, 0.05) 100%); border-radius: 12px; border: 1px solid rgba(203, 250, 241, 0.2);">
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          <span style="color: #4B3720; font-weight: 500;">Security Notice:</span> This verification link will expire in <strong>1 hour</strong> for your security. If you didn't request this verification, you can safely ignore this email.
        </p>
      </div>
    </div> 
    <!-- Footer Section -->
    <div style="background: linear-gradient(135deg, #f8faf8 0%, #f1f5f1 100%); padding: 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;"> 
      <div style="margin-bottom: 16px;">
        <span style="color: #4B3720; font-size: 18px; font-weight: 700; letter-spacing: -0.01em;">Overlanding Outpost</span>
      </div>
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">Your gateway to epic overland adventures</p>
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} Overlanding Outpost. All rights reserved.</p>
    </div> 
  </div> 
  <!-- Mobile Responsiveness -->
  <style>
    @media only screen and (max-width: 600px) {
      body { padding: 20px 10px !important; }
      .container { border-radius: 12px !important; }
      .header { padding: 40px 20px 30px !important; }
      .content { padding: 40px 20px !important; }
      h1 { font-size: 28px !important; }
      h2 { font-size: 22px !important; }
      .cta-button { padding: 14px 32px !important; font-size: 15px !important; }
      .footer { padding: 24px 20px !important; }
    }
  </style>
</body> 
</html>`;
  await sendEmail(to, html, 'Overlanding Outpost: Verify Your Account');
};
