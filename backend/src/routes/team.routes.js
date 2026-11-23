const express = require('express');
const router = express.Router();
const TeamController = require('../controllers/team.controller');

// All team routes are protected and owner-scoped
router.get('/', TeamController.listTeamMembers);
router.post('/', TeamController.createTeamMember);
router.put('/:id', TeamController.updateTeamMember);
router.delete('/:id', TeamController.deleteTeamMember);

module.exports = router;