// public/js/state.js

export const state = {
  authUser: null,     // firebase auth user
  profile: null,      // firestore user document

  location: {
    lat: null,
    lng: null
  },

  ui: {
    activeTab: "overview",
    loading: false
  },

  stats: {
    totalMeals: 0,
    totalWaste: 0
  }
};
