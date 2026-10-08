import globals from "globals";
import react from "eslint-plugin-react";
export default [{
  files: ["src/**/*.{js,jsx}"],
  plugins: { react },
  languageOptions: {
    ecmaVersion: "latest", sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: { ...globals.browser, __APP_VERSION__: "readonly", __BUILD_TIME__: "readonly", __BUILD_SHA__: "readonly" },
  },
  rules: { "no-undef": "error", "react/jsx-no-undef": "error", "react/jsx-uses-vars": "error", "no-unused-vars": "off", "no-dupe-keys": "error", "no-redeclare": "error" },
}];
