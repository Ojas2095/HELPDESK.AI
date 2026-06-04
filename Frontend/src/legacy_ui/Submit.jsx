import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import logo from "../assets/logo.svg";
import submitSuccessImg from "../assets/submit-success.svg";
import submitFailImg from "../assets/submit-fail.svg";
import img1 from "../assets/carousel1.svg";
import img2 from "../assets/carousel2.svg";
import img3 from "../assets/carousel3.svg";
import "./Submit.css";

const Submit = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !description || !email || !category || !priority) {
      toast.error("All fields are required");
      return;
    }

    try {
      // TODO: Replace with actual API call
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          email,
          category,
          priority,
        }),
      });

      if (response.ok) {
        setSubmitStatus("success");
        setTitle("");
        setDescription("");
        setEmail("");
        setCategory("");
        setPriority("");
        toast.success("Ticket submitted successfully!");
      } else {
        setSubmitStatus("error");
        toast.error("Failed to submit ticket. Please try again.");
      }
    } catch (error) {
      setSubmitStatus("error");
      toast.error("Network error. Please check your connection.");
    }
  };

  if (submitStatus === "success") {
    return (
      <div className="submit-success">
        <img src={submitSuccessImg} alt="Submit Success" />
        <h2>Ticket Submitted!</h2>
        <p>Your ticket has been successfully submitted.</p>
        <button onClick={() => navigate("/")}>Back to Home</button>
      </div>
    );
  }

  if (submitStatus === "error") {
    return (
      <div className="submit-error">
        <img src={submitFailImg} alt="Submit Failed" />
        <h2>Submission Failed</h2>
        <p>There was an error submitting your ticket.</p>
        <button onClick={() => setSubmitStatus(null)}>Try Again</button>
        <button onClick={() => navigate("/")}>Back to Home</button>
      </div>
    );
  }

  return (
    <div className="submit-page">
      {/* Carousel Section */}
      <div className="carousel-section">
        <h1>Submit a Ticket</h1>
        <div className="carousel">
          <img src={img1} alt="Step 1: Describe your issue" />
          <img src={img2} alt="Step 2: Select category and priority" />
          <img src={img3} alt="Step 3: Submit and track your ticket" />
        </div>
      </div>

      {/* Form Section */}
      <div className="form-section">
        <form onSubmit={handleSubmit} className="ticket-form">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of your issue"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of your issue"
              rows={5}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select Category</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature Request</option>
                <option value="support">Support</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">Select Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <button type="submit" className="submit-btn">
            Submit Ticket
          </button>
        </form>
      </div>
    </div>
  );
};

export default Submit;
