module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        details: {
          username: appGlobals.local.username,
          email: appGlobals.local.email
        }
      };
    },
    computed: {
      showBlock: function () {
        if(this.details.username.length) {
          return true;
        }
        return false;
      }
    }
  };
};
