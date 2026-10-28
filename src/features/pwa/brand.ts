/*
 * Raw colours for the manifest and the generated icons. These files are not
 * styled by CSS, so they cannot read the variables of src/styles/tokens.css:
 * the values below are copies of --paper, --pink, --ink and --blue.
 */
export const BRAND = {
  paper: "#fff4d6",
  pink: "#ff3fa4",
  ink: "#1b1b6b",
  blue: "#2f6bff",
} as const;

export const APP_NAME = "WeWatch";
export const APP_DESCRIPTION = "Swipe des films, tirage de la soirée";
