module.exports = function (appGlobals) {
  return {
    template: require('./template.html'),
    data: function () {
      return {
        details: {
          name: appGlobals.facebook.name,
          email: appGlobals.facebook.email
        },
        posts: [],
        showLoading: false
      };
    },
    computed: {
      showPosts: function () {
        if(this.posts.length) {
          return true;
        }
        return false;
      },
      showBlock: function () {
        if(this.details.name.length) {
          return true;
        }
        return false;
      }
    },
    methods: {
      getPosts: function () {
        this.showLoading = true;
        this.$http.get(appGlobals.fbURL)
        .then(function (res) {
          this.showLoading = false;
          res.data.data.forEach(function (post) {
            this.posts.push(post);
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
