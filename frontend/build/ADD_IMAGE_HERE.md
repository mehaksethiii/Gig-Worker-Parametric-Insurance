# Add Hero Image

To add the delivery rider illustration to the homepage:

1. Save the delivery rider image as: `hero-delivery-rider.jpg`
2. Place it in this folder: `frontend/public/`
3. The image should show the delivery rider on scooter with weather elements

The CSS is already configured to use this image as the hero section background.

## Image Requirements
- Filename: `hero-delivery-rider.jpg`
- Recommended size: 1200x600px or similar aspect ratio
- Format: JPG or PNG

## Alternative: Use a Different Image Path

If you want to use a different filename or location, update this line in `frontend/src/pages/HomePage.css`:

```css
.hero-illustration {
  background: url('/your-image-name.jpg') center/cover no-repeat;
}
```

## Using an External URL

You can also use an image URL directly:

```css
.hero-illustration {
  background: url('https://your-image-url.com/image.jpg') center/cover no-repeat;
}
```
