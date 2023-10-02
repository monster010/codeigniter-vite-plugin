import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import codeigniter from "codeigniter-vite-plugin";

export default defineConfig(() => {
  return {
    plugins: [
      codeigniter({
        input: ["resources/css/app.css", "resources/js/app.js"],
        refresh: true,
      }),
      vue({
        template: {
          transformAssetUrls: {
            base: null,
            includeAbsolute: false,
          },
        },
      }),
    ],
  };
});
