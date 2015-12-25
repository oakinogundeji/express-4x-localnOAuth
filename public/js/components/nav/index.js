module.exports = {
  template: require('./template.html'),
  methods: {
    changePage: function (page) {
      this.$dispatch('setpage', page);
      return null;
    }
  }
};
