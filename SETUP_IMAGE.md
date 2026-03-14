# 🎨 Setup Hero Image

## Quick Steps

1. **Save the delivery rider image** you have as `hero-delivery-rider.jpg`

2. **Place it in**: `frontend/public/hero-delivery-rider.jpg`

3. **Restart the frontend** (if running):
   ```bash
   # Stop the current process (Ctrl+C)
   # Then restart
   npm start
   ```

4. **The image will appear** in the hero section of the homepage automatically!

## What's Already Done

✅ CSS is configured to use the image as background  
✅ Hero section layout is ready  
✅ Overlay text is added for better visual appeal  
✅ Responsive design is implemented  

## File Location

```
frontend/
  └── public/
      └── hero-delivery-rider.jpg  ← Place your image here
```

## Alternative: Use Online Image

If you prefer to use an online image URL, edit `frontend/src/pages/HomePage.css`:

Find this line (around line 120):
```css
background: url('/hero-delivery-rider.jpg') center/cover no-repeat;
```

Replace with:
```css
background: url('https://your-image-url.com/image.jpg') center/cover no-repeat;
```

## Image Specifications

- **Format**: JPG or PNG
- **Recommended Size**: 1200x600px (2:1 ratio)
- **Max File Size**: < 500KB for best performance
- **Content**: Delivery rider on scooter with weather elements

## Troubleshooting

**Image not showing?**
- Check the filename is exactly: `hero-delivery-rider.jpg`
- Check it's in `frontend/public/` folder
- Clear browser cache (Ctrl+Shift+R)
- Check browser console for errors

**Image looks stretched?**
- Adjust the CSS `background-size` property
- Try `contain` instead of `cover`

---

Once you add the image, your homepage will have that beautiful illustrated hero section! 🚀
