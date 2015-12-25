module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        person: appGlobals.person,
        currentProfile: appGlobals.currentProfile,
        userPhoto: appGlobals.userPhoto,
        localLinkStatus: appGlobals.linkStatus.local,
        fbLinkStatus: appGlobals.linkStatus.fb,
        twitterLinkStatus: appGlobals.linkStatus.twitter,
        hideLinkAcct: appGlobals.hideLinkAcct,
        hideLocalLink: appGlobals.hideLocalLink,
        hideFBLink: appGlobals.hideFBLink,
        hideTwitterLink: appGlobals.hideTwitterLink
      };
    }
  };
};
