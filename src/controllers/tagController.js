const Tag = require('../models/tag.model');
const BaseController = require('./baseController');

class TagController extends BaseController {
  constructor() {
    super(Tag);
  }
}

module.exports = new TagController();
