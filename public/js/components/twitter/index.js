module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        details: {
          handle: appGlobals.twitter.handle,
          location: appGlobals.twitter.location,
          description: appGlobals.twitter.description
        },
        timeline: [],
        showLoading: false
      };
    },
    computed: {
      showTimeLine: function () {
        if(this.timeline.length) {
          return true;
        }
        return false;
      },
      showBlock: function () {
        if(this.details.handle.length) {
          return true;
        }
        return false;
      }
    },
    methods: {
      getTweets: function () {
        this.showLoading = true;
        this.$http.get(appGlobals.twitterURL)
        .then(function (res) {
          this.showLoading = false;
          res.data.msg.forEach(function (tweet) {
            this.timeline.push(tweet);
          }.bind(this))
        })
        .catch(function (info, status, req) {
          this.showLoading = false;
          this.posts.push(status);
        }.bind(this));
      }
    }
  };
};
