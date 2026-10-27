const ok      = (res, data, status = 200)        => res.status(status).json({ success: true,  data });
const created = (res, data)                       => res.status(201).json({ success: true,  data });
const noContent = (res)                           => res.status(204).send();
const badRequest = (res, message, errors = null)  => res.status(400).json({ success: false, message, errors });
const unauthorized = (res, message = 'Unauthorized') => res.status(401).json({ success: false, message });
const forbidden  = (res, message = 'Forbidden')   => res.status(403).json({ success: false, message });
const notFound   = (res, message = 'Not found')   => res.status(404).json({ success: false, message });
const conflict   = (res, message)                 => res.status(409).json({ success: false, message });
const serverError = (res, err) => {
  console.error(err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};

module.exports = { ok, created, noContent, badRequest, unauthorized, forbidden, notFound, conflict, serverError };
