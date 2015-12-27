'use strict';
/**
*Module dependencies
*/
var Vue = require('vue');
//==============================================================================
/**
*Module config
*/
Vue.use(require('vue-resource'));
Vue.http.options.root = '/root';
Vue.http.headers.common['Authorization'] = 'Basic YXBpOnBhc3N3b3Jk';
//==============================================================================
/**
*Create components
*/
//==============================================================================
var
  appGlobals = {
    person: window.appUserData.person,
    currentProfile: window.appUserData.currentProfile,
    facebook: {
      name: window.appUserData.fbName,
      email: window.appUserData.fbEmail
    },
    twitter: {
      handle: window.appUserData.twitterHandle,
      location: window.appUserData.twitterLocation,
      description: window.appUserData.twitterDescription
    },
    local: {
      username: window.appUserData.localUser,
      email: window.appUserData.localEmail
    },
    userPhoto: window.appUserData.userPhoto,
    fbURL: '/facebook',
    twitterURL: '/twitter/statuses/home_timeline',
    linkStatus: {
      local: window.appUserData.localLinkStatus,
      fb: window.appUserData.fbLinkStatus,
      twitter: window.appUserData.twitterLinkStatus
    },
    hideLinkAcct: window.appUserData.hideLinkAcct,
    hideLocalLink: window.appUserData.hideLocalLink,
    hideFBLink: window.appUserData.hideFBLink,
    hideTwitterLink: window.appUserData.hideTwitterLink
  },
  appNav = require('./components/nav'),
  appProfile = require('./components/profile')(appGlobals),
  appLocal = require('./components/local')(appGlobals),
  appFacebook = require('./components/facebook')(appGlobals),
  appTwitter = require('./components/twitter')(appGlobals);
/**
*Create base VM
*/
var vm = new Vue({
  el: '#app',
  data: {
    currentPage: 'app-profile'
  },
  events: {
    'setpage': function (page) {
      if(page == 'profile') {
        this.currentPage = 'app-profile';
        return null;
      }
      if(page == 'local') {
        this.currentPage = 'app-local';
        return null;
      }
      if(page == 'facebook') {
        this.currentPage = 'app-facebook';
        return null;
      }
      if(page == 'twitter') {
        this.currentPage = 'app-twitter';
        return null;
      }
    }
  },
  components: {
    'app-nav': appNav,
    'app-profile': appProfile,
    'app-local': appLocal,
    'app-facebook': appFacebook,
    'app-twitter': appTwitter
  }
});
