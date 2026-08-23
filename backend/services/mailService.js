const env = require('../config/env');

const ensureBrevoConfigured = () => {
  if (!env.brevoApiKey || !env.brevoSenderEmail) {
    const error = new Error('Brevo email delivery is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL to enable system emails.');
    error.statusCode = 503;
    throw error;
  }
};

const sendBrevoEmail = async ({ to, subject, htmlContent }) => {
  ensureBrevoConfigured();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.brevoApiKey
    },
    body: JSON.stringify({
      sender: {
        email: env.brevoSenderEmail,
        name: env.brevoSenderName
      },
      to,
      subject,
      htmlContent
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || 'Brevo failed to send the email.');
    error.statusCode = 502;
    throw error;
  }
};

const sendPasswordResetEmail = async ({ toEmail, toName, resetUrl }) => {
  await sendBrevoEmail({
    to: [
      {
        email: toEmail,
        name: toName || toEmail
      }
    ],
    subject: 'Reset your KEREA HRMS password',
    htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
          <h2 style="margin-bottom: 12px;">Reset your password</h2>
          <p>Hello ${toName || 'there'},</p>
          <p>We received a request to reset your KEREA HRMS password.</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #166534; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600;">
              Reset password
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `
  });
};

const buildLeaveCard = ({ employeeName, employeeNo, departmentName, leaveTypeLabel, startDate, endDate, daysRequested, reason, reviewerName, comment, returnDate }) => `
  <div style="margin: 22px 0; overflow: hidden; border-radius: 20px; border: 1px solid #d1fae5; background: #ffffff; box-shadow: 0 18px 45px rgba(20,83,45,0.12);">
    <div style="background: linear-gradient(135deg, #14532d, #22c55e); padding: 18px 22px; color: #ffffff;">
      <p style="margin: 0; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.82;">KEREA HRMS Leave Desk</p>
      <h2 style="margin: 6px 0 0; font-size: 22px; line-height: 1.25;">Leave request details</h2>
    </div>
    <div style="padding: 20px 22px; color: #0f172a;">
      ${employeeName ? `<p style="margin: 0 0 10px;"><strong>Employee:</strong> ${employeeName}${employeeNo ? ` (${employeeNo})` : ''}</p>` : ''}
      ${departmentName ? `<p style="margin: 0 0 10px;"><strong>Department:</strong> ${departmentName}</p>` : ''}
      <p style="margin: 0 0 10px;"><strong>Leave type:</strong> ${leaveTypeLabel || 'Leave'}</p>
      <p style="margin: 0 0 10px;"><strong>Dates:</strong> ${startDate}${endDate && endDate !== startDate ? ` to ${endDate}` : ''}</p>
      ${daysRequested ? `<p style="margin: 0 0 10px;"><strong>Working days:</strong> ${daysRequested}</p>` : ''}
      ${returnDate ? `<p style="margin: 0 0 10px;"><strong>Expected return:</strong> ${returnDate}</p>` : ''}
      ${reviewerName ? `<p style="margin: 0 0 10px;"><strong>Reviewed by:</strong> ${reviewerName}</p>` : ''}
      ${reason ? `<p style="margin: 0 0 10px;"><strong>Reason:</strong> ${reason}</p>` : ''}
      ${comment ? `<p style="margin: 0;"><strong>Comment:</strong> ${comment}</p>` : ''}
    </div>
  </div>
`;

const buildLeaveRequestUrl = (requestId) => `${String(env.frontendUrl || '').replace(/\/+$/, '')}/leaves/${encodeURIComponent(requestId)}`;

const buildTravelRequestUrl = (requestId) => `${String(env.frontendUrl || '').replace(/\/+$/, '')}/travel/${encodeURIComponent(requestId)}`;

const buildActionLink = ({ url, label }) => `
  <div style="margin: 24px 0;">
    <a href="${url}" style="display: inline-block; padding: 13px 22px; background: #166534; color: #ffffff; text-decoration: none; border-radius: 14px; font-weight: 700;">
      ${label}
    </a>
  </div>
  <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">If the button does not work, copy and paste this link into your browser:</p>
  <p style="margin: 0 0 18px; word-break: break-all; font-size: 13px;"><a href="${url}" style="color: #166534;">${url}</a></p>
`;

const sendLeaveApplicationEmail = async ({ recipients, request, stageLabel }) => {
  const to = (recipients || [])
    .filter((recipient) => recipient?.email)
    .map((recipient) => ({ email: recipient.email, name: recipient.fullName || recipient.email }));

  if (!to.length) {
    return;
  }

  const requestUrl = buildLeaveRequestUrl(request.id);

  await sendBrevoEmail({
    to,
    subject: `New leave request from ${request.employeeName}`,
    htmlContent: `
      <div style="margin: 0; background: #f0fdf4; padding: 28px; font-family: Arial, sans-serif; color: #0f172a; line-height: 1.55;">
        <div style="margin: 0 auto; max-width: 640px;">
          <p style="margin: 0 0 12px; color: #166534; font-weight: 700;">Action required</p>
          <h1 style="margin: 0; font-size: 28px; color: #052e16;">${request.employeeName} has applied for leave</h1>
          <p style="margin: 12px 0 0; color: #475569;">A leave request is waiting for ${stageLabel || 'your review'} in KEREA HRMS.</p>
          ${buildLeaveCard({
            employeeName: request.employeeName,
            employeeNo: request.employeeNo,
            departmentName: request.employeeDepartmentName,
            leaveTypeLabel: request.leaveTypeLabel,
            startDate: request.startDate,
            endDate: request.endDate,
            daysRequested: request.daysRequested,
            reason: request.reason
          })}
          ${buildActionLink({ url: requestUrl, label: 'Open leave request in HRMS' })}
          <p style="margin: 0; color: #475569;">Please log in to HRMS to review and action this application.</p>
        </div>
      </div>
    `
  });
};

const sendLeaveDecisionEmail = async ({ toEmail, toName, leaveTypeLabel, startDate, endDate, daysRequested, status, reviewerName, comment, returnDate }) => {
  const isAwaitingCeo = status === 'pending_ceo';
  const normalizedStatus = isAwaitingCeo ? 'Awaiting CEO Approval' : status === 'approved' ? 'Approved' : 'Denied';
  const accent = isAwaitingCeo ? '#2563eb' : status === 'approved' ? '#16a34a' : '#dc2626';
  const headline = isAwaitingCeo
    ? `Hello ${toName || 'there'}, your leave has been approved by your supervisor and is awaiting CEO approval.`
    : `Hello ${toName || 'there'}, your leave has been ${normalizedStatus.toLowerCase()}.`;

  await sendBrevoEmail({
    to: [
      {
        email: toEmail,
        name: toName || toEmail
      }
    ],
    subject: isAwaitingCeo ? `Your ${leaveTypeLabel || 'leave'} request is awaiting CEO approval` : `Your ${leaveTypeLabel || 'leave'} request was ${normalizedStatus.toLowerCase()}`,
    htmlContent: `
      <div style="margin: 0; background: #f8fafc; padding: 28px; font-family: Arial, sans-serif; color: #0f172a; line-height: 1.55;">
        <div style="margin: 0 auto; max-width: 640px;">
          <p style="margin: 0 0 12px; color: ${accent}; font-weight: 700;">Leave request ${normalizedStatus}</p>
          <h1 style="margin: 0; font-size: 28px; color: #0f172a;">${headline}</h1>
          ${buildLeaveCard({
            leaveTypeLabel,
            startDate,
            endDate,
            daysRequested,
            reviewerName: reviewerName || 'HRMS',
            comment,
            returnDate
          })}
          <p style="margin: 0; color: #475569;">Please log in to HRMS for the latest status details.</p>
        </div>
      </div>
    `
  });
};

const sendSupervisorDecisionToCeoEmail = async ({ recipients, request, supervisorName, decision, comment }) => {
  const to = (recipients || [])
    .filter((recipient) => recipient?.email)
    .map((recipient) => ({ email: recipient.email, name: recipient.fullName || recipient.email }));

  if (!to.length) {
    return;
  }

  const approved = decision === 'approve';
  const accent = approved ? '#16a34a' : '#dc2626';
  const decisionLabel = approved ? 'approved' : 'rejected';
  const requestUrl = buildLeaveRequestUrl(request.id);

  await sendBrevoEmail({
    to,
    subject: `Supervisor ${decisionLabel} leave request from ${request.employeeName}`,
    htmlContent: `
      <div style="margin: 0; background: #f8fafc; padding: 28px; font-family: Arial, sans-serif; color: #0f172a; line-height: 1.55;">
        <div style="margin: 0 auto; max-width: 640px;">
          <p style="margin: 0 0 12px; color: ${accent}; font-weight: 700;">Supervisor decision recorded</p>
          <h1 style="margin: 0; font-size: 28px; color: #0f172a;">${supervisorName || 'The supervisor'} has ${decisionLabel} ${request.employeeName}'s leave request.</h1>
          <p style="margin: 12px 0 0; color: #475569;">${approved ? 'This leave request is now waiting for CEO final approval in KEREA HRMS.' : 'This leave request was disapproved by the supervisor and is shown for CEO visibility.'}</p>
          ${buildLeaveCard({
            employeeName: request.employeeName,
            employeeNo: request.employeeNo,
            departmentName: request.employeeDepartmentName,
            leaveTypeLabel: request.leaveTypeLabel,
            startDate: request.startDate,
            endDate: request.endDate,
            daysRequested: request.daysRequested,
            reason: request.reason,
            reviewerName: supervisorName,
            comment
          })}
          ${buildActionLink({ url: requestUrl, label: approved ? 'Review leave request in HRMS' : 'View leave request in HRMS' })}
          <p style="margin: 0; color: #475569;">Please log in to HRMS for the latest status details.</p>
        </div>
      </div>
    `
  });
};

const buildTravelCard = ({ employeeName, employeeNo, departmentName, origin, destination, startDate, endDate, reason, estimatedCost, receiptAmount, receiptDescription }) => `
  <div style="margin: 22px 0; overflow: hidden; border-radius: 20px; border: 1px solid #dbeafe; background: #ffffff; box-shadow: 0 18px 45px rgba(30,64,175,0.12);">
    <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 18px 22px; color: #ffffff;">
      <p style="margin: 0; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.82;">KEREA HRMS Travel Desk</p>
      <h2 style="margin: 6px 0 0; font-size: 22px; line-height: 1.25;">Travel request details</h2>
    </div>
    <div style="padding: 20px 22px; color: #0f172a;">
      ${employeeName ? `<p style="margin: 0 0 10px;"><strong>Employee:</strong> ${employeeName}${employeeNo ? ` (${employeeNo})` : ''}</p>` : ''}
      ${departmentName ? `<p style="margin: 0 0 10px;"><strong>Department:</strong> ${departmentName}</p>` : ''}
      <p style="margin: 0 0 10px;"><strong>Route:</strong> ${origin} → ${destination}</p>
      <p style="margin: 0 0 10px;"><strong>Dates:</strong> ${startDate}${endDate && endDate !== startDate ? ` to ${endDate}` : ''}</p>
      ${estimatedCost ? `<p style="margin: 0 0 10px;"><strong>Estimated cost:</strong> ${estimatedCost}</p>` : ''}
      ${receiptAmount ? `<p style="margin: 0 0 10px;"><strong>Receipt amount:</strong> ${receiptAmount}</p>` : ''}
      ${reason ? `<p style="margin: 0 0 10px;"><strong>Reason:</strong> ${reason}</p>` : ''}
      ${receiptDescription ? `<p style="margin: 0;"><strong>Receipt description:</strong> ${receiptDescription}</p>` : ''}
    </div>
  </div>
`;

const sendTravelReceiptNotificationEmail = async ({ recipients, travelRequest, receipt, uploaderName }) => {
  const to = (recipients || [])
    .filter((recipient) => recipient?.email)
    .map((recipient) => ({ email: recipient.email, name: recipient.name || recipient.email }));

  if (!to.length) {
    return;
  }

  const requestUrl = buildTravelRequestUrl(travelRequest.id);

  await sendBrevoEmail({
    to,
    subject: `Travel receipt uploaded by ${uploaderName}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">Travel Receipt Uploaded</h2>
        <p style="margin: 0 0 18px;">${uploaderName} has uploaded a receipt for a travel request.</p>
        <p style="margin: 0 0 18px;">
          <strong>Travel Request:</strong> ${travelRequest.origin} to ${travelRequest.destination}<br>
          <strong>Travel Type:</strong> ${travelRequest.travel_type}<br>
          <strong>Receipt File:</strong> ${receipt.file_name}
        </p>
        <p style="margin: 0 0 18px;">
          <a href="${requestUrl}" style="background-color: #166534; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Travel Request</a>
        </p>
      </div>
    `
  });
};

const sendTravelRequestSubmittedEmail = async ({ recipients, travelRequest, applicantName }) => {
  const to = (recipients || [])
    .filter((recipient) => recipient?.email)
    .map((recipient) => ({ email: recipient.email, name: recipient.fullName || recipient.email }));

  if (!to.length) {
    return;
  }

  const requestUrl = buildTravelRequestUrl(travelRequest.id);
  
  // Format dates without time
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  // Handle both camelCase and snake_case field names
  const travelType = travelRequest.travelType || travelRequest.travel_type || 'Not specified';
  const origin = travelRequest.origin || 'Not specified';
  const destination = travelRequest.destination || 'Not specified';
  const startDate = formatDate(travelRequest.startDate || travelRequest.start_date);
  const endDate = formatDate(travelRequest.endDate || travelRequest.end_date);
  const estimatedCost = travelRequest.estimatedCost || travelRequest.estimated_cost;
  const currency = travelRequest.currency || 'KES';
  const reason = travelRequest.reason || 'Not specified';

  await sendBrevoEmail({
    to,
    subject: `New travel request from ${applicantName}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #166534;">New Travel Request Submitted</h2>
        <p style="margin: 0 0 18px;">${applicantName} has submitted a new travel request for your review.</p>
        <p style="margin: 0 0 18px;">
          <strong>Travel Type:</strong> ${travelType}<br>
          <strong>Origin:</strong> ${origin}<br>
          <strong>Destination:</strong> ${destination}<br>
          <strong>Start Date:</strong> ${startDate}<br>
          <strong>End Date:</strong> ${endDate}<br>
          <strong>Estimated Cost:</strong> ${estimatedCost ? `${currency} ${Number(estimatedCost).toLocaleString()}` : 'Not specified'}<br>
          <strong>Reason:</strong> ${reason}
        </p>
        <p style="margin: 0 0 18px;">
          <a href="${requestUrl}" style="background-color: #166534; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Review Travel Request</a>
        </p>
      </div>
    `
  });
};

const sendTravelDecisionEmail = async ({ toEmail, toName, travelRequest, decision, reviewerName, comment }) => {
  const isApproved = decision === 'approve';
  const accent = isApproved ? '#16a34a' : '#dc2626';
  const statusLabel = isApproved ? 'Approved' : 'Rejected';
  
  // Format dates without time
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  await sendBrevoEmail({
    to: [
      {
        email: toEmail,
        name: toName || toEmail
      }
    ],
    subject: `Your travel request has been ${statusLabel.toLowerCase()}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 24px; border-radius: 12px 12px 0 0; color: #ffffff;">
          <h1 style="margin: 0; font-size: 24px; line-height: 1.3;">Travel Request ${statusLabel}</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">KEREA HRMS Travel Management</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <p style="margin: 0 0 20px; font-size: 16px; color: #1e293b;">
            Hello <strong>${toName || 'there'}</strong>, your travel request has been <span style="color: ${accent}; font-weight: bold;">${statusLabel.toLowerCase()}</span> by <strong>${reviewerName}</strong>.
          </p>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 12px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Travel Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 140px;">Travel Type:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${travelRequest.travelType || travelRequest.travel_type || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Origin:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${travelRequest.origin || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Destination:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${travelRequest.destination || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Start Date:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${formatDate(travelRequest.startDate || travelRequest.start_date)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">End Date:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${formatDate(travelRequest.endDate || travelRequest.end_date)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Estimated Cost:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${travelRequest.estimatedCost || travelRequest.estimated_cost ? `${travelRequest.currency || 'KES'} ${Number(travelRequest.estimatedCost || travelRequest.estimated_cost).toLocaleString()}` : 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Reason:</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${travelRequest.reason || 'Not specified'}</td>
              </tr>
            </table>
          </div>
          
          ${comment ? `
          <div style="background: ${isApproved ? '#dcfce7' : '#fee2e2'}; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${accent};">
            <h3 style="margin: 0 0 8px; font-size: 14px; color: #475569;">${isApproved ? 'Approval' : 'Rejection'} Comment</h3>
            <p style="margin: 0; color: #1e293b; font-size: 14px;">${comment}</p>
          </div>
          ` : ''}
          
          <p style="margin: 0; color: #64748b; font-size: 14px;">If you have any questions, please contact your supervisor or the IT Officer.</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
          This is an automated email from KEREA HRMS
        </div>
      </div>
    `
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendLeaveApplicationEmail,
  sendLeaveDecisionEmail,
  sendSupervisorDecisionToCeoEmail,
  sendTravelReceiptNotificationEmail,
  sendTravelRequestSubmittedEmail,
  sendTravelDecisionEmail
};
