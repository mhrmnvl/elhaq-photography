import createNextIntlPlugin from "next-intl/plugin";
import type {NextConfig} from "next";

const nextConfig: NextConfig = {images: {loader: "custom", loaderFile: "./src/lib/cloudinary-loader.ts", deviceSizes: [640, 960, 1280, 1600, 1920, 2400], imageSizes: [320, 480, 640, 960, 1200, 1600, 2400]}, devIndicators: {position: "bottom-right"}};
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
