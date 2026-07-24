var transport = null;
var _nodemailer = null;

async function getTransport() {
  if (transport) return transport;

  try {
    _nodemailer = (await import('nodemailer')).default;
  } catch {
    console.log('nodemailer not available. Emails disabled.');
    return null;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transport = _nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    try {
      await transport.verify();
      console.log('SMTP configured: ' + process.env.SMTP_USER);
    } catch (err) {
      console.error('SMTP verify failed — emails may not send: ' + err.message);
      console.error('Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in Railway variables.');
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error('WARNING: No SMTP configured in production. Verification emails will NOT be delivered.');
      console.error('Set SMTP_HOST, SMTP_USER, SMTP_PASS in Railway Variables.');
      console.error('Free options: Gmail App Password, SendGrid (100/day), Mailgun, Mailtrap.');
      return null;
    }
    var testAccount = await _nodemailer.createTestAccount();
    transport = _nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('SMTP not configured. Using Ethereal test email.');
    console.log('  Captured emails at: https://ethereal.email/login');
    console.log('  Username: ' + testAccount.user);
    console.log('  Password: ' + testAccount.pass);
  }

  return transport;
}

async function sendEmail(to, subject, html) {
  var t = await getTransport();
  if (!t) {
    console.log('Email not sent to ' + to + ' — no transport available.');
    console.log('To send emails, set SMTP_HOST, SMTP_USER, SMTP_PASS in Railway Variables.');
    return null;
  }
  var fromName = process.env.EMAIL_FROM_NAME || 'Project Manager';
  var fromAddr = process.env.EMAIL_FROM_ADDRESS || (t.options.auth ? t.options.auth.user : 'noreply@projectmanager.app');

  var info = await t.sendMail({
    from: '"' + fromName + '" <' + fromAddr + '>',
    to: to,
    subject: subject,
    html: html,
  });

  if (info.messageId && !process.env.SMTP_HOST && process.env.NODE_ENV !== 'production' && _nodemailer) {
    var previewUrl = _nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('Preview email: ' + previewUrl);
    }
  }

  console.log('Email sent to ' + to + ' — ' + subject);
  return info;
}

function buildVerifyEmail(link) {
  return '<div style="max-width:480px;margin:40px auto;font-family:Inter,system-ui,sans-serif;background:#181A23;border-radius:16px;padding:40px;color:#F5F0EB;"><div style="text-align:center;margin-bottom:32px;"><div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#3DAF6E,#4A8BC2);display:inline-flex;align-items:center;justify-content:center;color:white;font-size:24px;">📁</div></div><h1 style="font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Verify your email</h1><p style="color:#A19A92;font-size:15px;line-height:1.5;text-align:center;margin:0 0 28px;">Click the button below to verify your email address and activate your account.</p><div style="text-align:center;"><a href="' + link + '" style="display:inline-block;background:#3DAF6E;color:white;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Verify Email</a></div><p style="color:#7A7370;font-size:13px;text-align:center;margin-top:28px;">This link expires in 24 hours. If you did not sign up for Project Manager, ignore this email.</p></div>';
}

function buildResetEmail(link) {
  return '<div style="max-width:480px;margin:40px auto;font-family:Inter,system-ui,sans-serif;background:#181A23;border-radius:16px;padding:40px;color:#F5F0EB;"><div style="text-align:center;margin-bottom:32px;"><div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#3DAF6E,#4A8BC2);display:inline-flex;align-items:center;justify-content:center;color:white;font-size:24px;">🔑</div></div><h1 style="font-size:22px;font-weight:700;margin:0 0 8px;text-align:center;">Reset your password</h1><p style="color:#A19A92;font-size:15px;line-height:1.5;text-align:center;margin:0 0 28px;">Click the button below to reset your password. This link is valid for 1 hour.</p><div style="text-align:center;"><a href="' + link + '" style="display:inline-block;background:#3DAF6E;color:white;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Reset Password</a></div><p style="color:#7A7370;font-size:13px;text-align:center;margin-top:28px;">If you did not request a password reset, ignore this email.</p></div>';
}

export default { sendEmail, buildVerifyEmail, buildResetEmail };
