import { useState } from "react";
import { Link, useHistory } from "react-router-dom";

const Register = () => {
  const history = useHistory();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fname: "",
    mname: "",
    lname: "",
    address: "",
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const response = await fetch(
        "https://itservicesph.com/IT383/CORTEZ/Cortez/index.php/API_user/registerAccount",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const text = await response.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("Non-JSON response from server:", text);
        setErrorMsg("Server error. Please contact the administrator.");
        setLoading(false);
        return;
      }

      setLoading(false);

      if (data.status === "success") {
        setSuccessMsg("Account registered! Redirecting to login...");
        setTimeout(() => {
          history.push("/login");
        }, 1500);
      } else {
        setErrorMsg(data.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg("Network error. Check your connection or CORS settings.");
      console.error(err);
    }
  };

  return (
    <div
    className="min-vh-100 d-flex align-items-start justify-content-center"
    style={{
      background: "linear-gradient(180deg, #4e73df 10%, #224abe 100%)",
    }}
  >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-10 col-lg-10 col-md-5">

            {/* Card */}
            <div
              className="card o-hidden border-0 shadow-lg my-5"
              style={{ borderRadius: "0.35rem", overflow: "hidden" }}
            >
              <div className="card-body p-0">
                <div className="row g-0">

                  {/* Left column: background image */}
                  <div
                    className="col-lg-5 d-none d-lg-block"
                    style={{
                      backgroundImage:
                        "url('https://source.unsplash.com/random/800x900?office,work')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      minHeight: "10px",
                    }}
                  />

                  {/* Right column: form */}
                  <div className="col-lg-7">
                    <div className="p-5">

                      {/* Heading */}
                      <div className="text-center">
                        <h1 className="h4 text-gray-900 mb-4">Create an Account!</h1>
                      </div>

                      {/* Alerts */}
                      {errorMsg && (
                        <div className="alert alert-danger" role="alert">
                          {errorMsg}
                        </div>
                      )}
                      {successMsg && (
                        <div className="alert alert-success" role="alert">
                          {successMsg}
                        </div>
                      )}

                      {/* Form */}
                      <form className="user" onSubmit={handleSubmit}>

                        {/* Row 1: Username + Password */}
                        <div className="form-group row">
                          <div className="col-sm-6 mb-3 mb-sm-0">
                            <input
                              type="text"
                              className="form-control form-control-user"
                              name="username"
                              placeholder="Username"
                              required
                              value={formData.username}
                              onChange={handleChange}
                            />
                          </div>
                          <div className="col-sm-6">
                            <input
                              type="password"
                              className="form-control form-control-user"
                              name="password"
                              placeholder="Password"
                              required
                              value={formData.password}
                              onChange={handleChange}
                            />
                          </div>
                        </div>

                        {/* First Name */}
                        <div className="form-group">
                          <input
                            type="text"
                            className="form-control form-control-user"
                            name="fname"
                            placeholder="First Name"
                            required
                            value={formData.fname}
                            onChange={handleChange}
                          />
                        </div>

                        {/* Middle Name */}
                        <div className="form-group">
                          <input
                            type="text"
                            className="form-control form-control-user"
                            name="mname"
                            placeholder="Middle Name"
                            required
                            value={formData.mname}
                            onChange={handleChange}
                          />
                        </div>

                        {/* Row 2: Last Name + Address */}
                        <div className="form-group row">
                          <div className="col-sm-6 mb-3 mb-sm-0">
                            <input
                              type="text"
                              className="form-control form-control-user"
                              name="lname"
                              placeholder="Last Name"
                              required
                              value={formData.lname}
                              onChange={handleChange}
                            />
                          </div>
                          <div className="col-sm-6">
                            <input
                              type="text"
                              className="form-control form-control-user"
                              name="address"
                              placeholder="Address"
                              required
                              value={formData.address}
                              onChange={handleChange}
                            />
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          className="btn btn-primary btn-user btn-block w-100"
                          disabled={loading}
                        >
                          {loading ? "Registering..." : "Register"}
                        </button>

                        <hr />

                      </form>

                      <hr />

                      {/* Login link */}
                      <div className="text-center">
                        <Link
                          to="/login"
                          style={{ textAlign: "center", color: "black" }}
                        >
                          Already have an account? Login!
                        </Link>
                      </div>

                    </div>
                  </div>
                  {/* end right column */}

                </div>
              </div>
            </div>
            {/* end card */}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;