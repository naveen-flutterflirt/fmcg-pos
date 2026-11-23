const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model');

class TeamController {
  static async listTeamMembers(req, res, next) {
    try {
      if (req.user.role !== 'distributor_owner') {
        return res.status(403).json({
          success: false,
          message: 'Only the Distributor Owner can view and manage enterprise team members.',
        });
      }

      const users = await UserModel.findAll();
      res.json({
        success: true,
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createTeamMember(req, res, next) {
    try {
      if (req.user.role !== 'distributor_owner') {
        return res.status(403).json({
          success: false,
          message: 'Only the Distributor Owner can create team members.',
        });
      }

      const { name, email, password, role = 'manager', phone, permissions = [] } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required to add a team member.',
        });
      }

      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A user with this email address already exists.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const id = `usr-${Date.now().toString(36)}`;

      const newUser = await UserModel.createUser({
        id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: role.trim(),
        phone: phone ? phone.trim() : null,
        permissions: Array.isArray(permissions) ? permissions : [],
      });

      res.status(201).json({
        success: true,
        message: 'Team member added successfully',
        data: newUser,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateTeamMember(req, res, next) {
    try {
      if (req.user.role !== 'distributor_owner') {
        return res.status(403).json({
          success: false,
          message: 'Only the Distributor Owner can modify team permissions.',
        });
      }

      const { id } = req.params;
      const { name, role, phone, permissions, status } = req.body;

      const targetUser = await UserModel.findById(id);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      const updated = await UserModel.updateUser(id, {
        name,
        role,
        phone,
        permissions,
        status,
      });

      res.json({
        success: true,
        message: 'Team member updated successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteTeamMember(req, res, next) {
    try {
      if (req.user.role !== 'distributor_owner') {
        return res.status(403).json({
          success: false,
          message: 'Only the Distributor Owner can remove team members.',
        });
      }

      const { id } = req.params;
      if (id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own active owner account.',
        });
      }

      const target = await UserModel.findById(id);
      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      if (target.role === 'distributor_owner') {
        return res.status(400).json({
          success: false,
          message: 'Distributor Owner accounts cannot be deleted.',
        });
      }

      await UserModel.deleteUser(id);

      res.json({
        success: true,
        message: 'Team member removed successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TeamController;