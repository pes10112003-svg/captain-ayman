export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Captain Ayman";
export const APP_NAME_AR = process.env.NEXT_PUBLIC_APP_NAME_AR ?? "كابتن أيمن";
export const brandName = (locale: "ar" | "en") => (locale === "ar" ? APP_NAME_AR : APP_NAME);

export const GOALS = {
  fat_loss: "Fat loss",
  muscle_gain: "Muscle gain",
  recomposition: "Body recomposition",
  strength: "Strength",
  endurance: "Endurance",
  general_fitness: "General fitness",
  maintenance: "Maintenance",
} as const;
export type Goal = keyof typeof GOALS;
export const GOAL_KEYS = Object.keys(GOALS) as Goal[];

export const GENDERS = { male: "Male", female: "Female", other: "Other", unspecified: "Prefer not to say" } as const;
export type Gender = keyof typeof GENDERS;
export const GENDER_KEYS = Object.keys(GENDERS) as Gender[];

export const PHOTO_ANGLES = { front: "Front", side: "Side", back: "Back", other: "Other" } as const;
export type PhotoAngle = keyof typeof PHOTO_ANGLES;
export const PHOTO_ANGLE_KEYS = Object.keys(PHOTO_ANGLES) as PhotoAngle[];

/** Client permissions — additional restrictions *inside* a client's own account. */
export const PERMISSIONS = [
  { key: "viewWorkouts", label: "View workouts", description: "See the assigned training plan and today's workout.", group: "Workouts" },
  { key: "completeWorkouts", label: "Complete workouts", description: "Tick sets as done and finish the daily workout.", group: "Workouts" },
  { key: "enterActualReps", label: "Enter actual reps", description: "Log fewer (or more) reps than the target for a set.", group: "Workouts" },
  { key: "viewNutrition", label: "View nutrition", description: "See the meal plan and today's meals.", group: "Nutrition" },
  { key: "completeMeals", label: "Complete meals", description: "Mark meals as eaten (time is recorded automatically).", group: "Nutrition" },
  { key: "viewProgress", label: "View progress", description: "Open the Progress area (weight trend, body composition).", group: "Progress" },
  { key: "viewMeasurements", label: "View measurements", description: "See detailed body measurements history.", group: "Progress" },
  { key: "viewPhotos", label: "View progress photos", description: "See their own before/after photos.", group: "Progress" },
  { key: "uploadPhotos", label: "Upload progress photos", description: "Add their own progress photos from the phone.", group: "Progress" },
  { key: "editPersonalInfo", label: "Edit personal info", description: "Update phone, date of birth, gender and profile photo.", group: "Account" },
  { key: "changeOwnPassword", label: "Change own password", description: "Let the client change the password you gave them.", group: "Account" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export type Permissions = Record<PermissionKey, boolean>;
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

export const DEFAULT_PERMISSIONS: Permissions = {
  viewWorkouts: true,
  completeWorkouts: true,
  enterActualReps: true,
  viewNutrition: true,
  completeMeals: true,
  viewProgress: true,
  viewMeasurements: true,
  viewPhotos: true,
  uploadPhotos: false,
  editPersonalInfo: false,
  changeOwnPassword: false,
};

export const MUSCLE_GROUP_SUGGESTIONS = [
  "Push",
  "Pull",
  "Legs",
  "Upper body",
  "Lower body",
  "Full body",
  "Chest & triceps",
  "Back & biceps",
  "Shoulders & arms",
  "Glutes & hamstrings",
  "Core",
  "Cardio / conditioning",
];

export const COMMON_TIMEZONES = [
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Amman",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
];

export const ACTIVITY_LABELS: Record<string, string> = {
  "auth.login": "Logged in",
  "auth.password_changed": "Changed password",
  "auth.password_reset": "Reset password via link",
  "client.workout_set.completed": "Completed a set",
  "client.workout_set.partial": "Logged a partial set",
  "client.workout_set.reset": "Un-ticked a set",
  "client.workout.completed": "Completed workout",
  "client.meal.completed": "Ate a meal",
  "client.meal.undone": "Un-marked a meal",
  "client.photo.uploaded": "Uploaded a progress photo",
  "client.profile.updated": "Updated personal info",
  "coach.client.created": "Client created",
  "coach.client.updated": "Client profile updated",
  "coach.client.status_changed": "Account status changed",
  "coach.client.password_reset": "Password reset by coach",
  "coach.workout_plan.updated": "Workout plan updated",
  "coach.workout_log.edited": "Workout record edited",
  "coach.nutrition_plan.updated": "Nutrition plan updated",
  "coach.measurements.added": "Measurements added",
  "coach.measurement.deleted": "Measurement deleted",
  "coach.photo.uploaded": "Progress photo uploaded",
  "coach.photo.deleted": "Progress photo deleted",
  "coach.permissions.updated": "Permissions changed",
};
