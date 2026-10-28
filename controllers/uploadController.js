const fs = require('fs');
const path = require('path');

// Controller to handle image uploading to ImgBB
exports.uploadToImgBB = async (req, res) => {
  try {
    const { image, name, apiKey: customKey } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'ইমেজ ডাটা প্রদান করা হয়নি (Image base64 is required)',
      });
    }

    // Priority: custom key sent from client > environment variable > active default key
    const apiKey =
      customKey ||
      process.env.IMGBB_API_KEY ||
      '754d8fcb05936232d06f927a4a3a665d';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'ImageBB API Key পাওয়া যায়নি। অনুগ্রহ করে Settings থেকে একটি ভ্যালিড API Key যুক্ত করুন।',
      });
    }

    // Clean base64 string if it contains data URI header
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');

    const formData = new FormData();
    formData.append('image', cleanBase64);
    if (name) {
      formData.append('name', name);
    }

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.success && result.data) {
      return res.status(200).json({
        success: true,
        message: 'ইমেজ সফলভাবে ImageBB-তে আপলোড করা হয়েছে!',
        data: {
          url: result.data.url,
          display_url: result.data.display_url,
          thumb_url: result.data.thumb?.url || result.data.url,
          delete_url: result.data.delete_url,
          size: result.data.size,
          title: result.data.title,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error?.message || 'ImageBB API আপলোড ব্যর্থ হয়েছে। API Key টি সঠিক কিনা যাচাই করুন।',
      });
    }
  } catch (error) {
    console.error('ImgBB Upload Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'ImageBB সার্ভারে যোগাযোগ করা সম্ভব হয়নি',
    });
  }
};

// Fallback controller for local storage uploads
exports.uploadLocal = async (req, res) => {
  try {
    const { image, name } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'ইমেজ ডাটা প্রদান করা হয়নি',
      });
    }

    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = '.jpg';
    let base64Data = image;

    if (matches && matches.length === 3) {
      const mime = matches[1];
      base64Data = matches[2];
      if (mime.includes('png')) ext = '.png';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('gif')) ext = '.gif';
      else if (mime.includes('svg')) ext = '.svg';
    } else {
      base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    }

    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const cleanName = (name || 'product')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 20);
    const filename = `${cleanName}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${filename}`;

    return res.status(200).json({
      success: true,
      message: 'ছবি সার্ভারে সফলভাবে সেভ করা হয়েছে!',
      data: {
        url: fileUrl,
        filename: filename,
      },
    });
  } catch (error) {
    console.error('Local Upload Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'লোকাল আপলোড সম্পন্ন করা যায়নি',
    });
  }
};

