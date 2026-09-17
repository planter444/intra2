const express = require('express');
const { sendAppraisalSubmittedEmail, sendAppraisalReviewedEmail, sendAppraisalToCeoEmail } = require('../services/mailService');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/appraisal-submitted', authenticate, async (req, res, next) => {
  try {
    const { toEmail, toName, employeeName, period, appraisalUrl } = req.body;
    
    await sendAppraisalSubmittedEmail({
      toEmail,
      toName,
      employeeName,
      period,
      appraisalUrl
    });
    
    res.json({ success: true, message: 'Appraisal notification sent successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/appraisal-reviewed', authenticate, async (req, res, next) => {
  try {
    const { toEmail, toName, supervisorName, period, appraisalUrl } = req.body;
    
    await sendAppraisalReviewedEmail({
      toEmail,
      toName,
      supervisorName,
      period,
      appraisalUrl
    });
    
    res.json({ success: true, message: 'Appraisal review notification sent successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/appraisal-to-ceo', authenticate, async (req, res, next) => {
  try {
    const { toEmail, toName, employeeName, supervisorName, period, appraisalUrl } = req.body;
    
    await sendAppraisalToCeoEmail({
      toEmail,
      toName,
      employeeName,
      supervisorName,
      period,
      appraisalUrl
    });
    
    res.json({ success: true, message: 'CEO appraisal notification sent successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;